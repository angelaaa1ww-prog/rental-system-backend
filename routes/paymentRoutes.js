const express = require('express');
const router = express.Router();

const Payment = require('../models/Payment');
const auth = require('../middleware/authMiddleware');

// =====================
// GET ALL PAYMENTS
// =====================
router.get('/', auth, async (req, res) => {
  try {
    const payments = await Payment.find()
      .populate('tenant')
      .populate('house');

    res.json(payments);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// =====================
// CREATE PAYMENT
// =====================
router.post('/', auth, async (req, res) => {
  try {
    const { tenant, house, amount, month } = req.body;

    const payment = new Payment({
      tenant,
      house,
      amount,
      month
    });

    const saved = await payment.save();
    res.json(saved);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;