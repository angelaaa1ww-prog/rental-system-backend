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
// ASSIGN HOUSE TO TENANT (FIXED & SAFE)
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

    // ❌ block if house is taken by another tenant
    if (
      newHouse.status === "occupied" &&
      String(newHouse.tenant) !== String(tenant._id)
    ) {
      return res.status(400).json({ message: "House already occupied" });
    }

    // =====================
    // FREE OLD HOUSE (VERY IMPORTANT FIX)
    // =====================
    if (tenant.house) {
      const oldHouse = await House.findById(tenant.house);

      if (oldHouse && String(oldHouse._id) !== String(newHouse._id)) {
        oldHouse.status = "available";
        oldHouse.tenant = null;
        await oldHouse.save();
      }
    }

    // =====================
    // CLEAN ANY WRONG LINKS (extra safety)
    // =====================
    await House.updateMany(
      { tenant: tenant._id },
      { $set: { status: "available", tenant: null } }
    );

    // =====================
    // ASSIGN NEW HOUSE
    // =====================
    tenant.house = newHouse._id;
    await tenant.save();

    newHouse.status = "occupied";
    newHouse.tenant = tenant._id;
    await newHouse.save();

    return res.json({
      message: "Tenant assigned successfully",
      tenantId: tenant._id,
      houseId: newHouse._id
    });

  } catch (err) {
    return res.status(500).json({
      message: "Assignment failed",
      error: err.message
    });
  }
});


// =====================
// DELETE TENANT (SAFE MOVE-OUT)
// =====================
router.delete('/:id', auth, async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.params.id);

    if (!tenant) {
      return res.status(404).json({ message: "Tenant not found" });
    }

    // free assigned house
    if (tenant.house) {
      const house = await House.findById(tenant.house);

      if (house) {
        house.status = "available";
        house.tenant = null;
        await house.save();
      }
    }

    // safety cleanup
    await House.updateMany(
      { tenant: tenant._id },
      { $set: { status: "available", tenant: null } }
    );

    await tenant.deleteOne();

    return res.json({
      message: "Tenant removed successfully"
    });

  } catch (err) {
    return res.status(500).json({
      message: "Failed to delete tenant",
      error: err.message
    });
  }
});

module.exports = router;