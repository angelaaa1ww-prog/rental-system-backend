const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  passwordHash: {
    type: String,
    required: true
  },
  failedAttempts: {
    type: Number,
    default: 0
  },
  lockedUntil: {
    type: Date,
    default: null
  },
  lastAttemptAt: {
    type: Date,
    default: null
  },
  // 2FA fields
  twoFactorSecret: { type: String, default: null },
  twoFactorEnabled: { type: Boolean, default: false },
  // Known devices for new-device detection
  knownDevices: [{
    fingerprint: String,
    browser: String,
    device: String,
    ip: String,
    lastUsed: { type: Date, default: Date.now }
  }],
  // Email for login alerts
  alertEmail: { type: String, default: null },
  // Google OAuth ID
  googleId: { type: String, default: null }
}, { timestamps: true });

module.exports = mongoose.model('Admin', adminSchema);