const express = require('express');
const router = express.Router();

const Payment = require('../models/Payment');
const Tenant = require('../models/Tenant');
const House = require('../models/House');
const auth = require('../middleware/authMiddleware');


// =====================
// GENERATE MPESA-LIKE CODE (SIMULATION)
// =====================
const generateCode = () => {
  return "MPESA" + Math.random().toString(36).substring(2, 10).toUpperCase();
};


// =====================
// CREATE PAYMENT (MPESA READY CORE)
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

    // =====================
    // EXPECTED RENT
    // =====================
    const expectedRent = houseExists.rent || 0;

    // =====================
    // TOTAL PAID THIS MONTH
    // =====================
    const payments = await Payment.find({ tenant, house, month });

    const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

    const newTotal = totalPaid + Number(amount);

    // =====================
    // OVERPAY GUARD
    // =====================
    if (newTotal > expectedRent) {
      return res.status(400).json({
        message: "Overpayment detected",
        expected: expectedRent,
        alreadyPaid: totalPaid,
        attempted: amount
      });
    }

    // =====================
    // CREATE PAYMENT
    // =====================
    const payment = await Payment.create({
      tenant,
      house,
      amount,
      month,
      mpesaCode: generateCode(),
      status: "confirmed"
    });

    // =====================
    // UPDATE HOUSE STATUS
    // =====================
    const totalAfter = newTotal;

    if (totalAfter >= expectedRent) {
      houseExists.status = "occupied";
    }

    houseExists.tenant = tenant;
    await houseExists.save();

    // =====================
    // RESPONSE
    // =====================
    return res.json({
      message: "Payment successful",
      payment,
      balance: expectedRent - totalAfter
    });

  } catch (err) {
    return res.status(500).json({
      message: "Payment failed",
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