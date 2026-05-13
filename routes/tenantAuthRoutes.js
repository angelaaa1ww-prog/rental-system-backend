require('dotenv').config();
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const Tenant = require('../models/Tenant');
const sendSMS = require('../utils/sms');
const House = require('../models/House');
const Payment = require('../models/Payment');

// =============================================
// CONFIG
// =============================================
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is required in environment variables');
}
const JWT_EXPIRY = '1h'; // auto logout after 1 hour
const PORTAL_MAX_ATTEMPTS = 5; // lock after 5 failed attempts
const PORTAL_LOCK_TIME = 15 * 60 * 1000; // 15 minutes lockout

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
// ENSURE SAMPLE TENANT WITH PORTAL ACCESS (for testing)
// =============================================
const ensureSampleTenantWithPortal = async () => {
  try {
    const tenantCount = await Tenant.countDocuments({ portalUsername: { $exists: true, $ne: null } });
    if (tenantCount === 0) {
      // Find a tenant to use as sample
      const sampleTenant = await Tenant.findOne({ active: true });
      if (sampleTenant) {
        const portalPassword = 'tenant123';
        const passwordHash = await bcrypt.hash(portalPassword, 12);
        
        sampleTenant.portalUsername = sampleTenant.phone.replace(/[^\d]/g, '').slice(-8); // last 8 digits of phone
        sampleTenant.portalPasswordHash = passwordHash;
        await sampleTenant.save();
        
        console.log(`✅ Sample tenant portal created: ${sampleTenant.portalUsername} / ${portalPassword}`);
      }
    }
  } catch (err) {
    console.error('⚠️ Could not ensure sample tenant with portal:', err.message);
  }
};

// Call on module load
ensureSampleTenantWithPortal();

// =============================================
// TENANT LOGIN ROUTE
// POST /api/tenant-auth/login
// =============================================
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }

    const usernameNormalized = username.trim().toLowerCase();

    // Find tenant by portal username
    const tenant = await Tenant.findOne({ 
      portalUsername: usernameNormalized,
      active: true 
    });
    
    if (!tenant) {
      // If tenant not found, we still want to avoid user enumeration
      // So we simulate a delay and return generic error
      await new Promise(resolve => setTimeout(resolve, 100));
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    // Check if account is locked due to too many failed attempts
    if (tenant.portalLockedUntil && new Date() < tenant.portalLockedUntil) {
      const minutesLeft = Math.ceil((tenant.portalLockedUntil - new Date()) / 60000);
      return res.status(429).json({
        message: `Account locked due to too many failed attempts. Try again in ${minutesLeft} minute${minutesLeft > 1 ? 's' : ''}.`
      });
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(password, tenant.portalPasswordHash);
    if (!passwordMatch) {
      // Increment failed attempts
      tenant.portalFailedAttempts += 1;
      tenant.portalLastAttemptAt = new Date();
      if (tenant.portalFailedAttempts >= PORTAL_MAX_ATTEMPTS) {
        tenant.portalLockedUntil = new Date(Date.now() + PORTAL_LOCK_TIME);
      }
      await tenant.save();

      const remaining = Math.max(0, PORTAL_MAX_ATTEMPTS - tenant.portalFailedAttempts);

      if (remaining <= 0) {
        return res.status(429).json({
          message: `Account locked after ${PORTAL_MAX_ATTEMPTS} failed attempts. Try again in 15 minutes.`
        });
      }

      return res.status(401).json({
        message: `Invalid username or password. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining before lockout.`
      });
    }

    // SUCCESS
    // Reset failed attempts
    tenant.portalFailedAttempts = 0;
    tenant.portalLockedUntil = null;
    tenant.portalLastAttemptAt = new Date();
    await tenant.save();

    // Generate JWT token
    const token = jwt.sign(
      { tenantId: tenant._id, role: 'tenant' },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );

    // Get tenant data for response (excluding sensitive fields)
    const tenantData = {
      id: tenant._id,
      name: tenant.name,
      phone: tenant.phone,
      house: tenant.house,
      moveInDate: tenant.moveInDate,
      dueDate: tenant.dueDate,
      rentAmount: tenant.rentAmount,
      lastPaidMonth: tenant.lastPaidMonth
    };

    return res.json({
      message: 'Login successful',
      token,
      expiresIn: JWT_EXPIRY,
      tenant: tenantData
    });

  } catch (err) {
    console.error('Tenant login error:', err.message);
    return res.status(500).json({ message: 'Login failed', error: err.message });
  }
});

// =============================================
// VERIFY TOKEN ROUTE
// GET /api/tenant-auth/verify
// =============================================
router.get('/verify', (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    // Additional check: ensure tenant still exists and is active
    Tenant.findById(decoded.tenantId)
      .then(tenant => {
        if (!tenant || !tenant.active) {
          return res.status(401).json({ valid: false, message: 'Tenant not found or deactivated' });
        }
        
        return res.json({
          valid: true,
          tenantId: decoded.tenantId,
          role: decoded.role,
          exp: decoded.exp,
        });
      })
      .catch(() => {
        return res.status(401).json({ valid: false, message: 'Invalid tenant' });
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
// FORGOT PASSWORD ROUTE
// POST /api/tenant-auth/forgot-password
// =============================================
router.post('/forgot-password', async (req, res) => {
  try {
    const { username } = req.body;

    if (!username) {
      return res.status(400).json({ message: 'Username is required' });
    }

    const usernameNormalized = username.trim().toLowerCase();

    // Find tenant by portal username
    const tenant = await Tenant.findOne({ 
      portalUsername: usernameNormalized,
      active: true 
    });
    
    if (!tenant) {
      // Don't reveal that tenant doesn't exist
      return res.json({ message: 'If the username exists, a reset link has been sent' });
    }

    // Generate reset token
    const resetToken = Math.random().toString(36).substring(2, 15) + 
                      Math.random().toString(36).substring(2, 15);
    
    tenant.portalResetToken = resetToken;
    tenant.portalResetTokenExpires = new Date(Date.now() + 3600000); // 1 hour
    
    await tenant.save();

    // Send SMS with reset token (in production, you'd use email)
    try {
      await sendSMS(
        tenant.phone,
        `GHV Tenant Portal: Your password reset code is: ${resetToken}. Valid for 1 hour. If you didn't request this, ignore this message.`
      );
    } catch (smsError) {
      console.warn('Failed to send reset SMS:', smsError.message);
      // Still return success - token was generated
    }

    res.json({ message: 'If the username exists, a reset link has been sent' });

  } catch (err) {
    console.error('Forgot password error:', err.message);
    return res.status(500).json({ message: 'Failed to process request', error: err.message });
  }
});

// =============================================
// RESET PASSWORD ROUTE
// POST /api/tenant-auth/reset-password
// =============================================
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ message: 'Token and password are required' });
    }

    // Find tenant by reset token
    const tenant = await Tenant.findOne({
      portalResetToken: token,
      portalResetTokenExpires: { $gt: new Date() }
    });

    if (!tenant) {
      return res.status(400).json({ message: 'Invalid or expired reset token' });
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(password, 12);
    
    // Update tenant
    tenant.portalPasswordHash = passwordHash;
    tenant.portalResetToken = null;
    tenant.portalResetTokenExpires = null;
    tenant.portalFailedAttempts = 0;
    tenant.portalLockedUntil = null;
    
    await tenant.save();

    res.json({ message: 'Password has been reset successfully' });

  } catch (err) {
    console.error('Reset password error:', err.message);
    return res.status(500).json({ message: 'Failed to reset password', error: err.message });
  }
});

// =============================================
// GET TENANT PROFILE (for tenant portal)
// GET /api/tenant-auth/profile
// =============================================
router.get('/profile', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    // Find tenant with populated house
    const tenant = await Tenant.findById(decoded.tenantId)
      .populate('house')
      .select('-portalPasswordHash -portalResetToken -portalResetTokenExpires');
    
    if (!tenant || !tenant.active) {
      return res.status(404).json({ message: 'Tenant not found' });
    }

    // Get current balance
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    const paymentsThisMonth = await Payment.find({
      tenant: tenant._id,
      status: 'confirmed',
      paymentMethod: { $in: ['cash', 'mpesa', 'bank'] },
      createdAt: { $gte: startOfMonth, $lte: endOfMonth }
    });
    
    const totalPaidThisMonth = paymentsThisMonth.reduce((sum, p) => sum + p.amount, 0);
    const rentDue = tenant.rentAmount || 0;
    const balance = rentDue - totalPaidThisMonth;

    res.json({
      tenant: {
        id: tenant._id,
        name: tenant.name,
        phone: tenant.phone,
        house: tenant.house ? {
          id: tenant.house._id,
          houseNumber: tenant.house.houseNumber,
          location: tenant.house.location,
          apartment: tenant.house.apartment,
          bedrooms: tenant.house.bedrooms,
          rent: tenant.house.rent
        } : null,
        moveInDate: tenant.moveInDate,
        dueDate: tenant.dueDate,
        rentAmount: tenant.rentAmount,
        lastPaidMonth: tenant.lastPaidMonth
      },
      balance: {
        rentDue: rentDue,
        paidThisMonth: totalPaidThisMonth,
        balance: balance,
        status: balance <= 0 ? 'paid' : 'due'
      },
      recentPayments: paymentsThisMonth
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 5)
        .map(p => ({
          id: p._id,
          amount: p.amount,
          date: p.createdAt,
          method: p.paymentMethod,
          reference: p.reference,
          note: p.note
        }))
    });

  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired' });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token' });
    }
    return res.status(500).json({ message: 'Failed to load profile', error: err.message });
  }
});

// =============================================
// LOGOUT ROUTE (client clears token)
// POST /api/tenant-auth/logout
// =============================================
router.post('/logout', (req, res) => {
  res.json({ message: 'Logged out successfully' });
});

module.exports = router;