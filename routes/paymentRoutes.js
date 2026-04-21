const express = require('express');
const router = express.Router();

const Payment = require('../models/Payment');
const Tenant = require('../models/Tenant');
const House = require('../models/House');
const auth = require('../middleware/authMiddleware');


// =====================
// CREATE PAYMENT (STABLE)
// =====================
router.post('/', auth, async (req, res) => {
  try {
    const { tenant, house, amount, month } = req.body;

    if (!tenant || !house || !amount || !month) {
      return res.status(400).json({
        message: "tenant, house, amount, month required"
      });
    }

    if (amount <= 0) {
      return res.status(400).json({
        message: "Invalid payment amount"
      });
    }

    const tenantExists = await Tenant.findById(tenant);
    const houseExists = await House.findById(house);

    if (!tenantExists || !houseExists) {
      return res.status(404).json({
        message: "Tenant or House not found"
      });
    }

    // prevent duplicate monthly payment
    const existingPayment = await Payment.findOne({
      tenant,
      house,
      month
    });

    if (existingPayment) {
      return res.status(400).json({
        message: "Payment for this month already exists"
      });
    }

    // create payment
    const payment = await Payment.create({
      tenant,
      house,
      amount,
      month
    });

    // =====================
    // SAFE HOUSE SYNC
    // =====================

    if (!houseExists.tenant || String(houseExists.tenant) !== String(tenant)) {
      houseExists.tenant = tenant;
    }

    if (houseExists.status !== "occupied") {
      houseExists.status = "occupied";
    }

    await houseExists.save();

    return res.json({
      message: "Payment recorded successfully",
      payment
    });

  } catch (err) {
    return res.status(500).json({
      message: "Payment creation failed",
      error: err.message
    });
  }
});


// =====================
// GET ALL PAYMENTS
// =====================
router.get('/', auth, async (req, res) => {
  try {
    const payments = await Payment.find()
      .populate('tenant')
      .populate('house')
      .sort({ createdAt: -1 });

    return res.json(payments || []);
  } catch (err) {
    return res.status(500).json({
      message: "Failed to load payments",
      error: err.message
    });
  }
});


// =====================
// GET TENANT PAYMENTS
// =====================
router.get('/tenant/:id', auth, async (req, res) => {
  try {
    const payments = await Payment.find({ tenant: req.params.id })
      .populate('house')
      .sort({ createdAt: -1 });

    return res.json(payments || []);
  } catch (err) {
    return res.status(500).json({
      message: "Failed to load tenant payments",
      error: err.message
    });
  }
});

module.exports = router;