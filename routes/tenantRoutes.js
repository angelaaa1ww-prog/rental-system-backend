const express = require('express');
const router = express.Router();

const Tenant = require('../models/Tenant');
const House = require('../models/House');
const auth = require('../middleware/authMiddleware');


// =====================
// CREATE TENANT (UPDATED WITH DUE DATE)
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
      house: null,

      // 🔥 NEW: default rent cycle (30 days)
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    });

    const populated = await Tenant.findById(tenant._id).populate('house');

    res.status(201).json(populated);

  } catch (err) {
    res.status(500).json({
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

    res.json(tenants || []);

  } catch (err) {
    res.status(500).json({
      message: "Failed to load tenants",
      error: err.message
    });
  }
});


// =====================
// ASSIGN HOUSE
// =====================
router.put('/:id/assign', auth, async (req, res) => {
  try {
    const { houseId } = req.body;

    if (!houseId) {
      return res.status(400).json({ message: "houseId is required" });
    }

    const tenant = await Tenant.findById(req.params.id);
    const newHouse = await House.findById(houseId);

    if (!tenant || !newHouse) {
      return res.status(404).json({ message: "Tenant or House not found" });
    }

    if (newHouse.status === "occupied" &&
        String(newHouse.tenant) !== String(tenant._id)) {
      return res.status(400).json({ message: "House already occupied" });
    }

    // free old house
    if (tenant.house) {
      const oldHouse = await House.findById(tenant.house);
      if (oldHouse && String(oldHouse._id) !== String(newHouse._id)) {
        oldHouse.status = "available";
        oldHouse.tenant = null;
        await oldHouse.save();
      }
    }

    // cleanup wrong links
    await House.updateMany(
      { tenant: tenant._id },
      { $set: { status: "available", tenant: null } }
    );

    // assign new house
    tenant.house = newHouse._id;
    await tenant.save();

    newHouse.status = "occupied";
    newHouse.tenant = tenant._id;
    await newHouse.save();

    const updatedTenant = await Tenant.findById(tenant._id).populate('house');

    res.json({
      message: "Tenant assigned successfully",
      tenant: updatedTenant
    });

  } catch (err) {
    res.status(500).json({
      message: "Assignment failed",
      error: err.message
    });
  }
});


// =====================
// DELETE TENANT
// =====================
router.delete('/:id', auth, async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.params.id);

    if (!tenant) {
      return res.status(404).json({ message: "Tenant not found" });
    }

    if (tenant.house) {
      const house = await House.findById(tenant.house);
      if (house) {
        house.status = "available";
        house.tenant = null;
        await house.save();
      }
    }

    await House.updateMany(
      { tenant: tenant._id },
      { $set: { status: "available", tenant: null } }
    );

    await tenant.deleteOne();

    res.json({ message: "Tenant removed successfully" });

  } catch (err) {
    res.status(500).json({
      message: "Failed to delete tenant",
      error: err.message
    });
  }
});

module.exports = router;