const express = require('express');
const router = express.Router();

const RentRecord = require('../models/RentRecord');
const Tenant = require('../models/Tenant');
const auth = require('../middleware/authMiddleware');


// =====================
// GENERATE MONTHLY RENT (FIXED)
// =====================
router.post('/generate/:month', auth, async (req, res) => {
  try {
    const { month } = req.params;

    const tenants = await Tenant.find().populate('house');

    let count = 0;

    for (let t of tenants) {
      if (!t.house) continue;

      // 🔥 STRICT CHECK (tenant + month)
      const exists = await RentRecord.findOne({
        tenant: t._id,
        month
      });

      if (exists) continue;

      const record = new RentRecord({
        tenant: t._id,
        house: t.house._id,
        month,
        expectedAmount: t.house.rent,
        status: "unpaid"
      });

      await record.save();
      count++;
    }

    res.json({
      message: "Rent records generated",
      count
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


// =====================
// GET RENT BY MONTH
// =====================
router.get('/:month', auth, async (req, res) => {
  try {
    const records = await RentRecord.find({ month: req.params.month })
      .populate('tenant')
      .populate('house')
      .sort({ createdAt: -1 });

    res.json(records);

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;