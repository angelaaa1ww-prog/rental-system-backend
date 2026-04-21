const express = require('express');
const router = express.Router();

const Tenant = require('../models/Tenant');
const House = require('../models/House');
const Payment = require('../models/Payment');
const auth = require('../middleware/authMiddleware');


// =====================
// DASHBOARD STATS (STABLE VERSION)
// =====================
router.get('/', auth, async (req, res) => {
  try {
    const [tenants, houses, payments] = await Promise.all([
      Tenant.find(),
      House.find(),
      Payment.find()
    ]);

    // =====================
    // COUNTS
    // =====================
    const totalTenants = tenants.length;
    const totalHouses = houses.length;

    const occupiedHouses = houses.filter(h => h.status === "occupied").length;
    const availableHouses = houses.filter(h => h.status === "available").length;

    // =====================
    // CLEAN PAYMENT SUM
    // =====================
    const totalRevenue = payments.reduce((sum, p) => {
      if (!p.amount || p.amount < 0) return sum;
      return sum + p.amount;
    }, 0);

    // =====================
    // EXPECTED REVENUE (BASED ON VALID OCCUPIED LINKS)
    // =====================
    let expectedRevenue = 0;

    houses.forEach(h => {
      if (
        h.status === "occupied" &&
        h.rent &&
        h.rent > 0 &&
        h.tenant
      ) {
        expectedRevenue += h.rent;
      }
    });

    // =====================
    // ARREARS (SAFE FLOOR AT 0)
    // =====================
    const arrears = Math.max(0, expectedRevenue - totalRevenue);

    // =====================
    // PAYMENT RATE (SAFE)
    // =====================
    const paymentRate =
      expectedRevenue > 0
        ? (totalRevenue / expectedRevenue) * 100
        : 0;

    return res.json({
      totalTenants,
      totalHouses,
      occupiedHouses,
      availableHouses,
      totalRevenue,
      arrears,
      paymentRate: Math.round(paymentRate)
    });

  } catch (err) {
    return res.status(500).json({
      message: "Dashboard error",
      error: err.message
    });
  }
});

module.exports = router;