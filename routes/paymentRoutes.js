const express = require('express');
const router = express.Router();

const Payment = require('../models/Payment');
const Tenant = require('../models/Tenant');
const House = require('../models/House');
const auth = require('../middleware/authMiddleware');

// =====================
// CREATE PAYMENT
// =====================
router.post('/', auth, async (req, res) => {
  try {
    const { tenant, house, amount, month } = req.body;

    // 1. Validate input
    if (!tenant || !house || !amount || !month) {
      return res.status(400).json({ message: "All fields required" });
    }

    // 2. Check tenant exists
    const tenantExists = await Tenant.findById(tenant);
    if (!tenantExists) {
      return res.status(404).json({ message: "Tenant not found" });
    }

    // 3. Check house exists
    const houseExists = await House.findById(house);
    if (!houseExists) {
      return res.status(404).json({ message: "House not found" });
    }

    // 4. Create payment
    const payment = new Payment({
      tenant,
      house,
      amount,
      month
    });

    const saved = await payment.save();

    res.json({
      message: "Payment recorded successfully",
      payment: saved
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

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

module.exports = router;