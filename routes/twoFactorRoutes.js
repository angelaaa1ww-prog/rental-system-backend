const express = require('express');
const router = express.Router();
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const Admin = require('../models/Admin');
const auth = require('../middleware/authMiddleware');

// Generate 2FA secret and QR code
router.post('/setup', auth, async (req, res) => {
  try {
    const admin = await Admin.findOne({ email: req.user.email });
    if (!admin) return res.status(404).json({ message: 'Admin not found' });

    const secret = speakeasy.generateSecret({
      name: `GHV Rentals (${admin.email})`,
      issuer: 'Gifted Hands Ventures'
    });

    // Store secret temporarily (not enabled until verified)
    admin.twoFactorSecret = secret.base32;
    await admin.save();

    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

    return res.json({
      message: 'Scan the QR code with Google Authenticator',
      qrCode: qrCodeUrl,
      secret: secret.base32 // backup code for manual entry
    });
  } catch (err) {
    return res.status(500).json({ message: '2FA setup failed', error: err.message });
  }
});

// Verify and enable 2FA
router.post('/verify', auth, async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ message: 'Token is required' });

    const admin = await Admin.findOne({ email: req.user.email });
    if (!admin) return res.status(404).json({ message: 'Admin not found' });
    if (!admin.twoFactorSecret) return res.status(400).json({ message: 'Setup 2FA first' });

    const verified = speakeasy.totp.verify({
      secret: admin.twoFactorSecret,
      encoding: 'base32',
      token: token,
      window: 2 // allow 2 intervals tolerance
    });

    if (!verified) return res.status(400).json({ message: 'Invalid code. Try again.' });

    admin.twoFactorEnabled = true;
    await admin.save();

    return res.json({ message: '2FA enabled successfully!' });
  } catch (err) {
    return res.status(500).json({ message: '2FA verification failed', error: err.message });
  }
});

// Disable 2FA
router.post('/disable', auth, async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ message: 'Current 2FA code is required' });

    const admin = await Admin.findOne({ email: req.user.email });
    if (!admin) return res.status(404).json({ message: 'Admin not found' });
    if (!admin.twoFactorEnabled) return res.status(400).json({ message: '2FA is not enabled' });

    const verified = speakeasy.totp.verify({
      secret: admin.twoFactorSecret,
      encoding: 'base32',
      token: token,
      window: 2
    });

    if (!verified) return res.status(400).json({ message: 'Invalid code' });

    admin.twoFactorEnabled = false;
    admin.twoFactorSecret = null;
    await admin.save();

    return res.json({ message: '2FA disabled successfully' });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to disable 2FA', error: err.message });
  }
});

// Get 2FA status
router.get('/status', auth, async (req, res) => {
  try {
    const admin = await Admin.findOne({ email: req.user.email });
    if (!admin) return res.status(404).json({ message: 'Admin not found' });
    return res.json({ enabled: admin.twoFactorEnabled || false });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to get 2FA status', error: err.message });
  }
});

module.exports = router;
