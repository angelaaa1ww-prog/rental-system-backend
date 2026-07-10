const express = require('express');
const router = express.Router();
const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const sendSMS = require('../utils/sms');

const GOOGLE_CLIENT_ID = (process.env.GOOGLE_CLIENT_ID || process.env.REACT_APP_GOOGLE_CLIENT_ID || '').trim();
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRY = '1h';
const OWNER_PHONE = process.env.OWNER_PHONE || '+254140425022';

const client = new OAuth2Client(GOOGLE_CLIENT_ID);

router.post('/google', async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) return res.status(400).json({ message: 'Google credential is required' });

    // Verify the Google ID token
    let ticket;
    try {
      ticket = await client.verifyIdToken({
        idToken: credential,
        audience: GOOGLE_CLIENT_ID,
      });
    } catch (err) {
      console.error('Google ID token verification failed:', err.message);
      return res.status(401).json({ message: 'Invalid Google credential' });
    }

    const payload = ticket.getPayload();
    const googleEmail = payload.email?.toLowerCase().trim();

    if (!googleEmail) {
      return res.status(400).json({ message: 'No email found in Google account' });
    }

    // Check if this email belongs to an admin
    let admin = await Admin.findOne({ email: googleEmail });
    
    // Auto-authorize angelaaa1ww@gmail.com if it doesn't exist yet
    if (!admin && googleEmail === 'angelaaa1ww@gmail.com') {
      admin = await Admin.create({ 
        email: 'angelaaa1ww@gmail.com', 
        passwordHash: 'auto-created-for-google-auth',
        username: 'angela_' + Date.now() // Bypass old username_1 index if it exists
      });
    }

    if (!admin) {
      // Alert owner
      try {
        await sendSMS(OWNER_PHONE, `🚨 GHV Security: Google login attempt with unauthorized email: ${googleEmail}`);
      } catch (_) {}
      return res.status(403).json({ message: 'Not an authorized admin account' });
    }

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

    // Link Google ID if not already linked
    if (!admin.googleId) {
      admin.googleId = payload.sub;
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

    // Alert owner
    try {
      await sendSMS(OWNER_PHONE, `✅ GHV Login: Admin logged in via Google (${googleEmail}).`);
    } catch (_) {}

    return res.json({
      message: 'Login successful',
      token,
      expiresIn: JWT_EXPIRY,
    });
  } catch (err) {
    console.error('Google auth error:', err.message);
    return res.status(500).json({ message: 'Google login failed', error: err.message });
  }
});

module.exports = router;