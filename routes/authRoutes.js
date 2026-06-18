require('dotenv').config();
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const Admin = require('../models/Admin');
const sendSMS = require('../utils/sms');
const speakeasy = require('speakeasy');
const crypto = require('crypto');
const { sendLoginAlert } = require('../utils/email');
// =============================================
// CONFIG
// =============================================
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is required in environment variables');
}
const JWT_EXPIRY = '1h'; // auto logout after 1 hour
const MAX_ATTEMPTS = 5; // lock after 5 failed attempts
const LOCK_TIME = 15 * 60 * 1000; // 15 minutes lockout
const OWNER_PHONE = process.env.OWNER_PHONE || '+254140425022'; // Isaac's number

// =============================================
// HELPER: FORMAT DEVICE/BROWSER INFO FROM REQUEST
// =============================================
const getDeviceInfo = (req) => {
  const ua = req.headers['user-agent'] || 'Unknown device';
  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'Unknown IP';

  let browser = 'Browser';
  let device = 'Device';

  if (ua.includes('Chrome')) browser = 'Chrome';
  if (ua.includes('Firefox')) browser = 'Firefox';
  if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
  if (ua.includes('Edg')) browser = 'Edge';

  if (ua.includes('Android')) device = 'Android';
  else if (ua.includes('iPhone') || ua.includes('iPad')) device = 'iPhone/iPad';
  else if (ua.includes('Windows')) device = 'Windows PC';
  else if (ua.includes('Mac')) device = 'Mac';
  else if (ua.includes('Linux')) device = 'Linux';

  const time = new Date().toLocaleTimeString('en-KE', {
    hour: '2-digit', minute: '2-digit', hour12: true,
    timeZone: 'Africa/Nairobi'
  });

  const date = new Date().toLocaleDateString('en-KE', {
    day: 'numeric', month: 'short', year: 'numeric',
    timeZone: 'Africa/Nairobi'
  });

  return { browser, device, ip, time, date };
};

// =============================================
// HELPER: GET DEVICE FINGERPRINT
// =============================================
const getDeviceFingerprint = (req) => {
  const ua = req.headers['user-agent'] || '';
  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '';
  // Use IP subnet (first 3 octets) + UA for fingerprint
  const ipSubnet = ip.split('.').slice(0, 3).join('.');
  return crypto.createHash('sha256').update(`${ipSubnet}|${ua}`).digest('hex').substring(0, 16);
};

// =============================================
// ENSURE DEFAULT ADMIN EXISTS
// =============================================
const ensureDefaultAdmin = async () => {
  try {
    const adminCount = await Admin.countDocuments();
    if (adminCount === 0) {
      const adminEmail = process.env.ADMIN_EMAIL || 'giftedhandsventures@rentals.co.ke';
      const adminPassword = process.env.ADMIN_PASSWORD || 'wekesa22240331';
      const passwordHash = await bcrypt.hash(adminPassword, 12);
      await Admin.create({
        email: adminEmail.toLowerCase().trim(),
        passwordHash
      });
      console.log(`✅ Default admin created: ${adminEmail}`);
    }
  } catch (err) {
    console.error('⚠️ Could not ensure default admin:', err.message);
  }
};

// Call on module load
ensureDefaultAdmin();

// =============================================
// LOGIN ROUTE
// POST /api/auth/login
// =============================================
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const emailNormalized = email.trim().toLowerCase();

    // Find admin by email
    const admin = await Admin.findOne({ email: emailNormalized });
    if (!admin) {
      // If admin not found, we still want to avoid user enumeration
      // So we simulate a delay and return generic error
      await new Promise(resolve => setTimeout(resolve, 100));
      // Alert owner about login attempt with unknown email
      try {
        const { ip, time, date } = getDeviceInfo(req);
        await sendSMS(
          OWNER_PHONE,
          `🚨 GHV Security Alert: Login attempt with unknown email: ${emailNormalized}. IP: ${ip}. Time: ${time} ${date}.`
        );
      } catch (_) {}
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Check if account is locked due to too many failed attempts
    if (admin.lockedUntil && new Date() < admin.lockedUntil) {
      const minutesLeft = Math.ceil((admin.lockedUntil - new Date()) / 60000);
      // Alert owner about locked account attempt
      try {
        const { browser, device, ip, time, date } = getDeviceInfo(req);
        await sendSMS(
          OWNER_PHONE,
          `🚨 GHV Security Alert: Someone tried to login with locked account ${emailNormalized}. ${minutesLeft} min remaining. IP: ${ip}. Time: ${time} ${date}.`
        );
      } catch (_) {}
      return res.status(429).json({
        message: `Account locked due to too many failed attempts. Try again in ${minutesLeft} minute${minutesLeft > 1 ? 's' : ''}.`
      });
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(password, admin.passwordHash);
    if (!passwordMatch) {
      // Increment failed attempts
      admin.failedAttempts += 1;
      admin.lastAttemptAt = new Date();
      if (admin.failedAttempts >= MAX_ATTEMPTS) {
        admin.lockedUntil = new Date(Date.now() + LOCK_TIME);
      }
      await admin.save();

      const remaining = Math.max(0, MAX_ATTEMPTS - admin.failedAttempts);

      // Alert owner about failed attempt (if >= 2)
      if (admin.failedAttempts >= 2) {
        try {
          const { browser, device, ip, time, date } = getDeviceInfo(req);
          await sendSMS(
            OWNER_PHONE,
            `⚠️ GHV Security: Failed login attempt #${admin.failedAttempts} for ${emailNormalized}. Device: ${device}/${browser}. IP: ${ip}. Time: ${time} ${date}. ${remaining > 0 ? `${remaining} attempts left.` : 'Account now LOCKED for 15 mins.'}`
          );
        } catch (_) {}
      }

      if (remaining <= 0) {
        return res.status(429).json({
          message: `Account locked after ${MAX_ATTEMPTS} failed attempts. Try again in 15 minutes.`
        });
      }

      return res.status(401).json({
        message: `Invalid email or password. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining before lockout.`
      });
    }

    // SUCCESS
    // Check if 2FA is enabled
    if (admin.twoFactorEnabled) {
      const tempToken = jwt.sign(
        { email: admin.email, role: 'admin', pending2FA: true },
        JWT_SECRET,
        { expiresIn: '5m' }
      );
      return res.json({
        requires2FA: true,
        tempToken,
        message: 'Please enter your 2FA code'
      });
    }

    // Reset failed attempts
    admin.failedAttempts = 0;
    admin.lockedUntil = null;
    admin.lastAttemptAt = new Date();

    // ── New device detection ──
    const fingerprint = getDeviceFingerprint(req);
    const { browser, device, ip, time, date } = getDeviceInfo(req);
    const isKnown = (admin.knownDevices || []).some(d => d.fingerprint === fingerprint);
    
    if (!isKnown) {
      // Add to known devices
      if (!admin.knownDevices) admin.knownDevices = [];
      admin.knownDevices.push({ fingerprint, browser, device, ip, lastUsed: new Date() });
      // Keep only last 10 devices
      if (admin.knownDevices.length > 10) admin.knownDevices = admin.knownDevices.slice(-10);
      await admin.save();
      
      // Send email alert
      const alertTo = admin.alertEmail || admin.email;
      try {
        await sendLoginAlert(alertTo, { browser, device, ip, time, date });
      } catch (_) {
        console.log('Email alert failed — login still succeeded');
      }
    } else {
      // Update lastUsed for known device
      const dev = admin.knownDevices.find(d => d.fingerprint === fingerprint);
      if (dev) dev.lastUsed = new Date();
      await admin.save();
    }

    // Generate JWT token
    const token = jwt.sign(
      { email: admin.email, role: 'admin' },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );

    // Send login alert to owner
    try {
      const { browser, device, ip, time, date } = getDeviceInfo(req);
      await sendSMS(
        OWNER_PHONE,
        `✅ GHV Login Alert: Admin logged in successfully. Device: ${device}/${browser}. IP: ${ip}. Time: ${time}, ${date}. If this wasn't you, contact support immediately.`
      );
    } catch (_) {
      console.log('Login alert SMS failed — login still succeeded');
    }

    return res.json({
      message: 'Login successful',
      token,
      expiresIn: JWT_EXPIRY,
    });

  } catch (err) {
    console.error('Login error:', err.message);
    return res.status(500).json({ message: 'Login failed', error: err.message });
  }
});

// =============================================
// VERIFY 2FA DURING LOGIN
// POST /api/auth/verify-2fa
// =============================================
router.post('/verify-2fa', async (req, res) => {
  try {
    const { tempToken, totpCode } = req.body;
    if (!tempToken || !totpCode) {
      return res.status(400).json({ message: 'Token and 2FA code are required' });
    }

    let decoded;
    try {
      decoded = jwt.verify(tempToken, JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ message: '2FA session expired. Please login again.' });
    }

    if (!decoded.pending2FA) {
      return res.status(400).json({ message: 'Invalid 2FA session' });
    }

    const admin = await Admin.findOne({ email: decoded.email });
    if (!admin) return res.status(404).json({ message: 'Admin not found' });

    const verified = speakeasy.totp.verify({
      secret: admin.twoFactorSecret,
      encoding: 'base32',
      token: totpCode,
      window: 2
    });

    if (!verified) {
      return res.status(401).json({ message: 'Invalid 2FA code. Try again.' });
    }

    // New device detection for 2FA login
    const fingerprint = getDeviceFingerprint(req);
    const { browser, device, ip, time, date } = getDeviceInfo(req);
    const isKnown = (admin.knownDevices || []).some(d => d.fingerprint === fingerprint);
    
    if (!isKnown) {
      if (!admin.knownDevices) admin.knownDevices = [];
      admin.knownDevices.push({ fingerprint, browser, device, ip, lastUsed: new Date() });
      if (admin.knownDevices.length > 10) admin.knownDevices = admin.knownDevices.slice(-10);
      await admin.save();
      const alertTo = admin.alertEmail || admin.email;
      try { await sendLoginAlert(alertTo, { browser, device, ip, time, date }); } catch (_) {}
    } else {
      const dev = admin.knownDevices.find(d => d.fingerprint === fingerprint);
      if (dev) dev.lastUsed = new Date();
      await admin.save();
    }

    // Reset failed attempts
    admin.failedAttempts = 0;
    admin.lockedUntil = null;
    admin.lastAttemptAt = new Date();
    await admin.save();

    const token = jwt.sign(
      { email: admin.email, role: 'admin' },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );

    // Send login alert
    try {
      await sendSMS(
        OWNER_PHONE,
        `✅ GHV Login: Admin logged in (2FA verified). Device: ${device}/${browser}. IP: ${ip}. Time: ${time}, ${date}.`
      );
    } catch (_) {}

    return res.json({
      message: 'Login successful',
      token,
      expiresIn: JWT_EXPIRY,
    });
  } catch (err) {
    console.error('2FA verify error:', err.message);
    return res.status(500).json({ message: '2FA verification failed', error: err.message });
  }
});

// =============================================
// VERIFY TOKEN ROUTE
// GET /api/auth/verify
// =============================================
router.get('/verify', (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    return res.json({
      valid: true,
      email: decoded.email,
      role: decoded.role,
      exp: decoded.exp,
    });

  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ valid: false, message: 'Token expired' });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ valid: false, message: 'Invalid token' });
    }
    return res.status(401).json({ valid: false, message: 'Token invalid or expired' });
  }
});

// =============================================
// LOGOUT ROUTE (client clears token)
// POST /api/auth/logout
// =============================================
router.post('/logout', (req, res) => {
  res.json({ message: 'Logged out successfully' });
});

module.exports = router;