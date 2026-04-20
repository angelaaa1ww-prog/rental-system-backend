const express = require('express');
const router = express.Router();

const Tenant = require('../models/Tenant');
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
// ASSIGN HOUSE TO TENANT
// =====================
router.put('/:tenantId/assign', auth, async (req, res) => {
  try {
    const { houseId } = req.body;

    const tenant = await Tenant.findByIdAndUpdate(
      req.params.tenantId,
      { house: houseId },
      { new: true }
    );

    if (!tenant) {
      return res.status(404).json({ message: "Tenant not found" });
    }

    res.json(tenant);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;