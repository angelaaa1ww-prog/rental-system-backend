const express = require('express');
const router = express.Router();

const Payment = require('../models/Payment');
const Tenant = require('../models/Tenant');
const auth = require('../middleware/authMiddleware');

const sendSMS = require('../utils/sms');
const { stkPush } = require('../utils/mpesa'); // ✅ NEW M-PESA INTEGRATION


// =====================
// MAKE PAYMENT (STK PUSH + SAVE)
// =====================
router.post('/', auth, async (req, res) => {
  try {
    const { tenantId, amount, reference } = req.body;

    if (!tenantId || !amount || !reference) {
      return res.status(400).json({ message: "Missing fields" });
    }

    const tenant = await Tenant.findById(tenantId).populate('house');

    if (!tenant) {
      return res.status(404).json({ message: "Tenant not found" });
    }

    // =========================
    // 1. INITIATE STK PUSH
    // =========================
    const stkResponse = await stkPush(tenant.phone, amount);

    if (!stkResponse) {
      return res.status(500).json({
        message: "M-Pesa STK push failed"
      });
    }

    // =========================
    // 2. SAVE PAYMENT RECORD (PENDING CONFIRMATION)
    // =========================
    const payment = await Payment.create({
      tenant: tenantId,
      amount,
      reference,
      status: "pending"
    });

    // =========================
    // 3. SEND SMS ALERT
    // =========================
    if (tenant.phone) {
      await sendSMS(
        tenant.phone,
        `M-Pesa request sent: KES ${amount}. Please enter your PIN to complete payment.`
      );
    }

    return res.status(201).json({
      message: "STK push initiated",
      payment,
      stkResponse
    });

  } catch (err) {
    return res.status(500).json({
      message: "Payment failed",
      error: err.message
    });
  }
});


// =====================
// GET BALANCE
// =====================
router.get('/balance/:tenantId', auth, async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.params.tenantId).populate('house');

    if (!tenant) {
      return res.status(404).json({ message: "Tenant not found" });
    }

    const rent = tenant.house?.rent || 0;

    const payments = await Payment.find({
      tenant: tenant._id,
      status: "confirmed"
    });

    const paid = payments.reduce((sum, p) => sum + p.amount, 0);

    const balance = rent - paid;

    return res.json({
      rent,
      paid,
      balance
    });

  } catch (err) {
    return res.status(500).json({
      message: "Failed to calculate balance",
      error: err.message
    });
  }
});


// =====================
// PAYMENT HISTORY
// =====================
router.get('/:tenantId', auth, async (req, res) => {
  try {
    const payments = await Payment.find({ tenant: req.params.tenantId })
      .sort({ createdAt: -1 });

    return res.json(payments);

  } catch (err) {
    return res.status(500).json({
      message: "Failed to load payments",
      error: err.message
    });
  }
});

module.exports = router;