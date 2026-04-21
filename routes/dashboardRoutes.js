const express = require('express');
const router = express.Router();

const Tenant = require('../models/Tenant');
const House = require('../models/House');
const Payment = require('../models/Payment');
const auth = require('../middleware/authMiddleware');

// =====================
// DASHBOARD STATS
// =====================
router.get('/', auth, async (req, res) => {
  try {
    // 1. Count tenants
    const totalTenants = await Tenant.countDocuments();

    // 2. Count houses
    const totalHouses = await House.countDocuments();

    // 3. Sum revenue from payments
    const payments = await Payment.find();

    const totalRevenue = payments.reduce((sum, p) => {
      return sum + (p.amount || 0);
    }, 0);

    res.json({
      totalTenants,
      totalHouses,
      totalRevenue
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;