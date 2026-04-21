const express = require('express');
const router = express.Router();

const RentRecord = require('../models/RentRecord');
const Tenant = require('../models/Tenant');
const auth = require('../middleware/authMiddleware');

// =====================
// GENERATE MONTHLY RENT
// =====================
router.post('/generate/:month', auth, async (req, res) => {
  try {
    const { month } = req.params;

    const tenants = await Tenant.find().populate('house');

    let created = 0;

    for (const t of tenants) {
      if (!t.house) continue;

      const exists = await RentRecord.findOne({
        tenant: t._id,
        month
      });

      if (!exists) {
        await RentRecord.create({
          tenant: t._id,
          house: t.house._id,
          month,
          expectedAmount: t.house.rent,
          status: "unpaid"
        });

        created++;
      }
    }

    res.json({
      message: "Rent generated successfully",
      created
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// =====================
// GET RENT RECORDS
// =====================
router.get('/:month', auth, async (req, res) => {
  try {
    const data = await RentRecord.find({ month: req.params.month })
      .populate('tenant')
      .populate('house');

    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;