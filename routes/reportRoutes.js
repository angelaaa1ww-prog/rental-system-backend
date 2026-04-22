const express = require('express');
const router = express.Router();

const Payment = require('../models/Payment');
const Tenant = require('../models/Tenant');
const House = require('../models/House');
const auth = require('../middleware/authMiddleware');


// =====================
// MONTHLY REPORT
// =====================
router.get('/monthly', auth, async (req, res) => {
  try {
    const { month, year } = req.query;

    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59);

    const payments = await Payment.find({
      status: "confirmed",
      createdAt: { $gte: start, $lte: end }
    });

    const totalIncome = payments.reduce((sum, p) => sum + p.amount, 0);

    res.json({
      month,
      year,
      totalIncome,
      transactions: payments.length
    });

  } catch (err) {
    res.status(500).json({
      message: "Report error",
      error: err.message
    });
  }
});

module.exports = router;