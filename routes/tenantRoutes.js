const express = require('express');
const router = express.Router();

const Tenant = require('../models/Tenant');
const House = require('../models/House'); // ✅ added
const auth = require('../middleware/authMiddleware');

// =====================
// GET ALL TENANTS
// =====================
router.get('/', auth, async (req, res) => {
  try {
    const tenants = await Tenant.find();
    res.json(tenants);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// =====================
// CREATE TENANT
// =====================
router.post('/', auth, async (req, res) => {
  try {
    const { name, phone, idNumber } = req.body;

    const tenant = new Tenant({
      name,
      phone,
      idNumber,
      house: null,
      status: 'active'
    });

    const saved = await tenant.save();
    res.json(saved);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// =====================
// ASSIGN HOUSE TO TENANT (SMART)
// =====================
router.put('/:tenantId/assign', auth, async (req, res) => {
  try {
    const { houseId } = req.body;

    // 1. Check if house exists
    const house = await House.findById(houseId);
    if (!house) {
      return res.status(404).json({ message: "House not found" });
    }

    // 2. Prevent double booking
    if (house.status === "occupied") {
      return res.status(400).json({ message: "House already occupied" });
    }

    // 3. Assign tenant
    const tenant = await Tenant.findByIdAndUpdate(
      req.params.tenantId,
      { house: houseId },
      { new: true }
    );

    if (!tenant) {
      return res.status(404).json({ message: "Tenant not found" });
    }

    // 4. Update house status
    house.status = "occupied";
    await house.save();

    res.json({
      message: "Assigned successfully",
      tenant
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;