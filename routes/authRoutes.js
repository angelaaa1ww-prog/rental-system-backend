const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const SECRET = process.env.JWT_SECRET || 'rental_secret_change_me';

// Read from env — fallback to safe defaults for dev only
const ADMIN_EMAIL    = process.env.ADMIN_EMAIL    || 'admin@rentals.co.ke';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin1234';

// Hash once at startup (not on every request)
const HASHED_PASSWORD = bcrypt.hashSync(ADMIN_PASSWORD, 10);

// =====================
// LOGIN
// =====================
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password required' });
    }

    if (email.toLowerCase().trim() !== ADMIN_EMAIL.toLowerCase().trim()) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, HASHED_PASSWORD);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { email: ADMIN_EMAIL, role: 'admin' },
      SECRET,
      { expiresIn: '7d' }
    );

    return res.json({ token, role: 'admin' });

  } catch (err) {
    return res.status(500).json({ message: 'Login error', error: err.message });
  }
});

// =====================
// VERIFY TOKEN
// =====================
router.get('/verify', require('../middleware/authMiddleware'), (req, res) => {
  res.json({ valid: true, user: req.user });
});

module.exports = router;