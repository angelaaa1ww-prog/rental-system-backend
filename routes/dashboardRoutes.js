const express = require('express');
const router = express.Router();

const Tenant = require('../models/Tenant');
const House = require('../models/House');
const Payment = require('../models/Payment');
const auth = require('../middleware/authMiddleware');


// =====================
// DASHBOARD SUMMARY (OPTIMIZED)
// =====================
router.get('/', auth, async (req, res) => {
  try {

    // =====================
    // HOUSE STATS
    // =====================
    const totalHouses = await House.countDocuments();
    const occupied = await House.countDocuments({ status: "occupied" });
    const available = totalHouses - occupied;

    const occupancyRate = totalHouses === 0
      ? 0
      : Math.round((occupied / totalHouses) * 100);


    // =====================
    // PAYMENTS (FETCH ONCE ONLY)
    // =====================
    const payments = await Payment.find({ status: "confirmed" });

    const totalIncome = payments.reduce((sum, p) => sum + p.amount, 0);


    // =====================
    // TENANTS
    // =====================
    const tenants = await Tenant.find().populate('house');


    // =====================
    // BUILD PAYMENT MAP (FASTER)
    // =====================
    const paymentMap = {};

    payments.forEach(p => {
      const id = String(p.tenant);
      if (!paymentMap[id]) paymentMap[id] = 0;
      paymentMap[id] += p.amount;
    });


    // =====================
    // OVERDUE CALCULATION
    // =====================
    const overdueTenants = [];

    tenants.forEach(t => {
      if (!t.house) return;

      const rent = t.house.rent || 0;
      const paid = paymentMap[String(t._id)] || 0;

      const balance = rent - paid;

      if (balance > 0) {
        overdueTenants.push({
          name: t.name,
          phone: t.phone,
          house: t.house.houseNumber,
          rent,
          paid,
          balance
        });
      }
    });


    // =====================
    // RESPONSE
    // =====================
    res.json({
      totalHouses,
      occupied,
      available,
      occupancyRate,
      totalIncome,
      overdueCount: overdueTenants.length,
      overdueTenants
    });

  } catch (err) {
    res.status(500).json({
      message: "Dashboard error",
      error: err.message
    });
  }
});

module.exports = router;