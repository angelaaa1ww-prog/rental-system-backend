const express = require('express');
const router = express.Router();

const RentRecord = require('../models/RentRecord');
const Tenant = require('../models/Tenant');
const auth = require('../middleware/authMiddleware');

// =====================
// GET OVERDUE TENANTS
// =====================
router.get('/', auth, async (req, res) => {
  try {
    const overdue = await RentRecord.find({ status: "unpaid" })
      .populate('tenant')
      .populate('house');

    // group by tenant
    const map = {};

    overdue.forEach(r => {
      const id = r.tenant._id.toString();

      if (!map[id]) {
        map[id] = {
          tenant: r.tenant,
          totalDue: 0,
          months: []
        };
      }

      map[id].totalDue += r.expectedAmount || 0;
      map[id].months.push(r.month);
    });

    res.json(Object.values(map));

  } catch (err) {
    res.status(500).json({
      message: "Error fetching overdue",
      error: err.message
    });
  }
});

module.exports = router;