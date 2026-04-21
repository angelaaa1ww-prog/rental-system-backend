const express = require('express');
const router = express.Router();

const Tenant = require('../models/Tenant');
const House = require('../models/House');
const Payment = require('../models/Payment');
const auth = require('../middleware/authMiddleware');


// =====================
// DASHBOARD STATS (OPTIMIZED + SCALABLE)
// =====================
router.get('/', auth, async (req, res) => {
  try {
    const [
      totalTenants,
      totalHouses,
      occupiedHouses,
      availableHouses,
      revenueResult
    ] = await Promise.all([
      Tenant.countDocuments(),
      House.countDocuments(),
      House.countDocuments({ status: "occupied" }),
      House.countDocuments({ status: "available" }),

      // 🔥 AGGREGATION (NO MEMORY LOAD)
      Payment.aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: "$amount" }
          }
        }
      ])
    ]);

    const totalRevenue = revenueResult[0]?.total || 0;

    res.json({
      totalTenants,
      totalHouses,
      occupiedHouses,
      availableHouses,
      totalRevenue
    });

  } catch (err) {
    res.status(500).json({
      message: "Dashboard error",
      error: err.message
    });
  }
});

module.exports = router;