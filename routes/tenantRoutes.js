const express = require('express');
const router = express.Router();

const Tenant = require('../models/Tenant');
const House = require('../models/House');
const auth = require('../middleware/authMiddleware');


// =====================
// CREATE TENANT
// =====================
router.post('/', auth, async (req, res) => {
  try {
    const { name, phone, idNumber } = req.body;

    if (!name || !phone || !idNumber) {
      return res.status(400).json({ message: "All fields required" });
    }

    const tenant = await Tenant.create({
      name,
      phone,
      idNumber,
      house: null
    });

    return res.status(201).json(tenant);

  } catch (err) {
    return res.status(500).json({
      message: "Failed to create tenant",
      error: err.message
    });
  }
});


// =====================
// GET ALL TENANTS
// =====================
router.get('/', auth, async (req, res) => {
  try {
    const tenants = await Tenant.find()
      .populate('house')
      .sort({ createdAt: -1 });

    return res.status(200).json(tenants || []);

  } catch (err) {
    return res.status(500).json({
      message: "Failed to load tenants",
      error: err.message
    });
  }
});


// =====================
// ASSIGN HOUSE TO TENANT (STABLE)
// =====================
router.put('/:id/assign', auth, async (req, res) => {
  try {
    const { houseId } = req.body;

    if (!houseId) {
      return res.status(400).json({ message: "houseId is required" });
    }

    const tenant = await Tenant.findById(req.params.id);
    const house = await House.findById(houseId);

    if (!tenant || !house) {
      return res.status(404).json({ message: "Tenant or House not found" });
    }

    // block double booking
    if (house.status === "occupied" && String(house.tenant) !== String(tenant._id)) {
      return res.status(400).json({ message: "House already occupied" });
    }

    // free old house
    if (tenant.house) {
      const oldHouse = await House.findById(tenant.house);

      if (oldHouse && String(oldHouse._id) !== String(house._id)) {
        oldHouse.status = "available";
        oldHouse.tenant = null;
        await oldHouse.save();
      }
    }

    // extra cleanup safety
    const previousHouse = await House.findOne({ tenant: tenant._id });

    if (previousHouse && String(previousHouse._id) !== String(house._id)) {
      previousHouse.status = "available";
      previousHouse.tenant = null;
      await previousHouse.save();
    }

    // assign new
    tenant.house = house._id;
    await tenant.save();

    house.status = "occupied";
    house.tenant = tenant._id;
    await house.save();

    return res.json({
      message: "Tenant assigned successfully",
      tenantId: tenant._id,
      houseId: house._id
    });

  } catch (err) {
    return res.status(500).json({
      message: "Assignment failed",
      error: err.message
    });
  }
});


// =====================
// DELETE TENANT (MOVE OUT SAFE)
// =====================
router.delete('/:id', auth, async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.params.id);

    if (!tenant) {
      return res.status(404).json({ message: "Tenant not found" });
    }

    // free house first
    if (tenant.house) {
      const house = await House.findById(tenant.house);

      if (house) {
        house.status = "available";
        house.tenant = null;
        await house.save();
      }
    }

    await tenant.deleteOne();

    return res.json({ message: "Tenant deleted successfully" });

  } catch (err) {
    return res.status(500).json({
      message: "Failed to delete tenant",
      error: err.message
    });
  }
});

module.exports = router;