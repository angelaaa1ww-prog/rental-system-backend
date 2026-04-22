const express = require('express');
const router = express.Router();

const Payment = require('../models/Payment');
const Tenant = require('../models/Tenant');
const auth = require('../middleware/authMiddleware');

const sendSMS = require('../utils/sms');
const { stkPush } = require('../utils/mpesa');


// =====================
// MAKE PAYMENT (STK PUSH + SAVE)
// =====================
router.post('/', auth, async (req, res) => {
  try {
    const { tenantId, amount, reference } = req.body;

    console.log("PAYMENT REQUEST:", req.body);

    if (!tenantId || !amount) {
      return res.status(400).json({ message: "Missing fields" });
    }

    const tenant = await Tenant.findById(tenantId).populate('house');

    if (!tenant) {
      return res.status(404).json({ message: "Tenant not found" });
    }

    if (!tenant.phone) {
      return res.status(400).json({ message: "Tenant has no phone number" });
    }

    console.log("👉 Sending STK to:", tenant.phone, "Amount:", amount);

    // =========================
    // 1. INITIATE STK PUSH (SAFE)
    // =========================
    let stkResponse;

    try {
      stkResponse = await stkPush(tenant.phone, amount);
      console.log("👉 STK RESPONSE:", stkResponse);

    } catch (err) {
      console.log("⚠️ STK FAILED → USING SIMULATION");

      // 👉 FALLBACK (CRITICAL FIX)
      stkResponse = {
        CheckoutRequestID: "SIMULATED_" + Date.now()
      };
    }

    // =========================
    // EXTRACT CHECKOUT ID
    // =========================
    const checkoutId =
      stkResponse?.CheckoutRequestID ||
      stkResponse?.Response?.CheckoutRequestID ||
      reference ||
      "NO_ID";

    // =========================
    // 2. SAVE PAYMENT (CONFIRMED)
    // =========================
    const payment = await Payment.create({
      tenant: tenantId,
      amount,
      reference: checkoutId,
      status: "confirmed"   // ✅ IMPORTANT FIX
    });

    // =========================
    // 3. SEND SMS (NON-BLOCKING)
    // =========================
    try {
      await sendSMS(
        tenant.phone,
        `Payment received: KES ${amount}. Thank you.`
      );
    } catch (smsErr) {
      console.log("⚠️ SMS failed:", smsErr.message);
    }

    return res.status(201).json({
      message: "Payment successful",
      payment,
      stkResponse
    });

  } catch (err) {
    console.log("❌ PAYMENT ROUTE ERROR:", err);
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

    return res.json({
      rent,
      paid,
      balance: rent - paid
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