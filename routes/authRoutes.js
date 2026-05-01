require('dotenv').config();
const express  = require('express');
const router   = express.Router();
const jwt      = require('jsonwebtoken');
const sendSMS  = require('../utils/sms');

// =============================================
// SECURITY CONFIG
// =============================================
const ADMIN_EMAIL    = process.env.ADMIN_EMAIL    || 'admin@rentals.co.ke';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin1234';
const JWT_SECRET     = process.env.JWT_SECRET     || 'secret';
const OWNER_PHONE    = process.env.OWNER_PHONE    || '+254140425022'; // Isaac's number
const MAX_ATTEMPTS   = 5;   // lock after 5 failed attempts
const LOCK_TIME      = 15 * 60 * 1000; // 15 minutes lockout
const JWT_EXPIRY     = '1h'; // auto logout after 1 hour

// =============================================
// IN-MEMORY ATTEMPT TRACKER
// { email: { count, lockedUntil, lastAttempt } }
// =============================================
const loginAttempts = {};

const getAttempts = (email) => {
  if (!loginAttempts[email]) {
    loginAttempts[email] = { count: 0, lockedUntil: null };
  }
  return loginAttempts[email];
};

const resetAttempts = (email) => {
  loginAttempts[email] = { count: 0, lockedUntil: null };
};

const incrementAttempts = (email) => {
  const a = getAttempts(email);
  a.count += 1;
  a.lastAttempt = new Date();
  if (a.count >= MAX_ATTEMPTS) {
    a.lockedUntil = new Date(Date.now() + LOCK_TIME);
  }
  return a;
};

// =============================================
// FORMAT DEVICE/BROWSER INFO FROM REQUEST
// =============================================
const getDeviceInfo = (req) => {
  const ua = req.headers['user-agent'] || 'Unknown device';
  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'Unknown IP';

  let browser = 'Browser';
  let device  = 'Device';

  if (ua.includes('Chrome'))  browser = 'Chrome';
  if (ua.includes('Firefox')) browser = 'Firefox';
  if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
  if (ua.includes('Edg'))     browser = 'Edge';

  if (ua.includes('Android')) device = 'Android';
  else if (ua.includes('iPhone') || ua.includes('iPad')) device = 'iPhone/iPad';
  else if (ua.includes('Windows')) device = 'Windows PC';
  else if (ua.includes('Mac'))     device = 'Mac';
  else if (ua.includes('Linux'))   device = 'Linux';

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
// LOGIN ROUTE
// POST /api/auth/login
// =============================================
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const attempts = getAttempts(email);

    // ── Check if account is locked ──
    if (attempts.lockedUntil && new Date() < new Date(attempts.lockedUntil)) {
      const minutesLeft = Math.ceil((new Date(attempts.lockedUntil) - new Date()) / 60000);

      // Alert owner about repeated failed attempts
      try {
        await sendSMS(
          OWNER_PHONE,
          `🚨 GHV Security Alert: Someone tried to login with ${email} but the account is locked. ${minutesLeft} min remaining. Date: ${new Date().toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' })}`
        );
      } catch (_) {}

      return res.status(429).json({
        message: `Account locked due to too many failed attempts. Try again in ${minutesLeft} minute${minutesLeft > 1 ? 's' : ''}.`
      });
    }

    // ── Check credentials ──
    const emailMatch    = email.trim().toLowerCase() === ADMIN_EMAIL.trim().toLowerCase();
    const passwordMatch = password === ADMIN_PASSWORD;

    if (!emailMatch || !passwordMatch) {
      const updated = incrementAttempts(email);
      const remaining = MAX_ATTEMPTS - updated.count;

      // Alert owner if someone is trying wrong passwords
      if (updated.count >= 2) {
        try {
          const { browser, device, ip, time, date } = getDeviceInfo(req);
          await sendSMS(
            OWNER_PHONE,
            `⚠️ GHV Security: Failed login attempt #${updated.count} for ${email}. Device: ${device}/${browser}. IP: ${ip}. Time: ${time} ${date}. ${remaining > 0 ? `${remaining} attempts left.` : 'Account now LOCKED for 15 mins.'}`
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

    // ── SUCCESS — generate token ──
    resetAttempts(email);

    const token = jwt.sign(
      { email, role: 'admin' },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );

    // ── Send login alert to owner ──
    try {
      const { browser, device, ip, time, date } = getDeviceInfo(req);
      await sendSMS(
        OWNER_PHONE,
        `✅ GHV Login Alert: Admin logged in successfully. Device: ${device}/${browser}. IP: ${ip}. Time: ${time}, ${date}. If this wasn't you, contact support immediately.`
      );
    } catch (_) {
      // SMS failure should not block login
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
      role:  decoded.role,
      exp:   decoded.exp,
    });

  } catch (err) {
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