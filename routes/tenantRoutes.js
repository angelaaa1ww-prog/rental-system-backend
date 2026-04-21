const express = require('express');
const router = express.Router();

const Tenant = require('../models/Tenant');
const House = require('../models/House');
const auth = require('../middleware/authMiddleware');

// =====================
// GET ALL TENANTS
// =====================
router.get('/', auth, async (req, res) => {
  try {
    const tenants = await Tenant.find().populate('house');
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
// ASSIGN HOUSE
// =====================
router.put('/:tenantId/assign', auth, async (req, res) => {
  try {
    const { houseId } = req.body;

    if (!houseId) {
      return res.status(400).json({ message: "houseId is required" });
    }

    const house = await House.findById(houseId);
    if (!house) {
      return res.status(404).json({ message: "House not found" });
    }

    if (house.status === "occupied") {
      return res.status(400).json({ message: "House already occupied" });
    }

    const tenant = await Tenant.findById(req.params.tenantId);
    if (!tenant) {
      return res.status(404).json({ message: "Tenant not found" });
    }

    // prevent double assignment
    if (tenant.house) {
      return res.status(400).json({ message: "Tenant already has a house" });
    }

    tenant.house = houseId;
    await tenant.save();

    house.status = "occupied";
    house.tenant = tenant._id;
    await house.save();

    res.json({
      message: "Tenant assigned successfully",
      tenant
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// =====================
// UNASSIGN HOUSE
// =====================
router.put('/:tenantId/unassign', auth, async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.params.tenantId);

    if (!tenant) {
      return res.status(404).json({ message: "Tenant not found" });
    }

    if (tenant.house) {
      await House.findByIdAndUpdate(tenant.house, {
        status: "available",
        tenant: null
      });
    }

    tenant.house = null;
    await tenant.save();

    res.json({
      message: "Tenant unassigned successfully",
      tenant
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;