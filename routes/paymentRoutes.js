const express = require('express');
const router = express.Router();

const Payment = require('../models/Payment');
const Tenant = require('../models/Tenant');
const auth = require('../middleware/authMiddleware');


/**
 * ===============================
 * CREATE PAYMENT
 * ===============================
 */
router.post('/', auth, async (req, res) => {
  try {
    const { tenantId, amount, reference } = req.body;

    if (!tenantId || !amount) {
      return res.status(400).json({
        message: "tenantId and amount are required"
      });
    }

    const tenant = await Tenant.findById(tenantId);

    if (!tenant) {
      return res.status(404).json({
        message: "Tenant not found"
      });
    }

    const payment = await Payment.create({
      tenant: tenantId,
      amount: Number(amount),
      reference: reference || `PAY-${Date.now()}`
    });

    return res.status(201).json({
      message: "Payment recorded",
      payment
    });

  } catch (err) {
    return res.status(500).json({
      message: "Payment failed",
      error: err.message
    });
  }
});


/**
 * ===============================
 * GET TENANT BALANCE (FIXED)
 * ===============================
 */
router.get('/balance/:tenantId', auth, async (req, res) => {
  try {
    const { tenantId } = req.params;

    const tenant = await Tenant.findById(tenantId).populate('house');

    if (!tenant) {
      return res.status(404).json({
        message: "Tenant not found"
      });
    }

    const rent = tenant.house ? Number(tenant.house.rent) : 0;

    const payments = await Payment.find({ tenant: tenantId });

    const paid = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    const balance = rent - paid;

    return res.json({
      rent,
      paid,
      balance: balance < 0 ? 0 : balance
    });

  } catch (err) {
    return res.status(500).json({
      message: "Failed to compute balance",
      error: err.message
    });
  }
});


/**
 * ===============================
 * GET ALL PAYMENTS
 * ===============================
 */
router.get('/', auth, async (req, res) => {
  try {
    const payments = await Payment.find()
      .populate('tenant')
      .sort({ createdAt: -1 });

    return res.json(payments || []);

  } catch (err) {
    return res.status(500).json({
      message: "Failed to fetch payments",
      error: err.message
    });
  }
});

module.exports = router;