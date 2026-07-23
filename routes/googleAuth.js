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

// Default authorized emails list
const DEFAULT_AUTHORIZED_EMAILS = [
  'angelaaa1ww@gmail.com',
  'isowekesa@gmail.com',
  'giftedhandsventures@rentals.co.ke'
];

const envAuthorized = (process.env.AUTHORIZED_EMAILS || process.env.REACT_APP_AUTHORIZED_EMAILS || '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

const AUTHORIZED_EMAILS = Array.from(new Set([...DEFAULT_AUTHORIZED_EMAILS, ...envAuthorized]));

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

    // Auto-authorize known emails if they don't exist yet in this DB
    if (!admin && AUTHORIZED_EMAILS.includes(googleEmail)) {
      try {
        admin = await Admin.create({ 
          email: googleEmail, 
          passwordHash: 'auto-created-for-google-auth',
          username: googleEmail.split('@')[0] + '_' + Date.now(),
          failedAttempts: 0,
          lockedUntil: null
        });
        console.log(`Auto-created admin for: ${googleEmail}`);
      } catch (createErr) {
        console.error('Auto-create admin failed:', createErr.message);
        try {
          admin = await Admin.create({ email: googleEmail, passwordHash: 'auto-created-for-google-auth' });
        } catch (_) {}
      }
    }

    if (!admin) {
      // Alert owner
      try {
        await sendSMS(OWNER_PHONE, `🚨 GHV Security: Google login attempt with unauthorized email: ${googleEmail}`);
      } catch (_) {}
      return res.status(403).json({ message: `Account (${googleEmail}) is not authorized for admin access.` });
    }

    // Always reset failed attempts and unlock account on valid Google authentication
    admin.failedAttempts = 0;
    admin.lockedUntil = null;
    admin.lastAttemptAt = new Date();

    // Check if 2FA is enabled
    if (admin.twoFactorEnabled) {
      await admin.save();
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
    }

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