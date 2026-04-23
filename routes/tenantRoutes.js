const express = require('express');
const router  = express.Router();
const Tenant  = require('../models/Tenant');
const House   = require('../models/House');
const Payment = require('../models/Payment');
const auth    = require('../middleware/authMiddleware');

// =====================
// CREATE TENANT
// =====================
router.post('/', auth, async (req, res) => {
  try {
    const { name, phone, idNumber } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ message: 'Name and phone are required' });
    }

    // Check if ID number already exists (only if provided)
    if (idNumber && idNumber.trim()) {
      const existing = await Tenant.findOne({ idNumber: idNumber.trim() });
      if (existing) {
        return res.status(400).json({ message: 'A tenant with this ID number already exists' });
      }
    }

    const tenant = await Tenant.create({
      name:      name.trim(),
      phone:     phone.trim(),
      idNumber:  idNumber && idNumber.trim() ? idNumber.trim() : null,
      house:     null,
      active:    true
    });

    const populated = await Tenant.findById(tenant._id).populate('house');
    return res.status(201).json(populated);

  } catch (err) {
    return res.status(500).json({ message: 'Failed to create tenant', error: err.message });
  }
});

// =====================
// GET ALL TENANTS
// =====================
router.get('/', auth, async (req, res) => {
  try {
    const tenants = await Tenant.find({ active: true })
      .populate('house')
      .sort({ createdAt: -1 });
    return res.json(tenants || []);
  } catch (err) {
    return res.status(500).json({ message: 'Failed to load tenants', error: err.message });
  }
});

// =====================
// GET SINGLE TENANT
// =====================
router.get('/:id', auth, async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.params.id).populate('house');
    if (!tenant) return res.status(404).json({ message: 'Tenant not found' });
    return res.json(tenant);
  } catch (err) {
    return res.status(500).json({ message: 'Failed to load tenant', error: err.message });
  }
});

// =====================
// UPDATE TENANT
// =====================
router.put('/:id', auth, async (req, res) => {
  try {
    const { name, phone, idNumber } = req.body;
    const tenant = await Tenant.findById(req.params.id);
    if (!tenant) return res.status(404).json({ message: 'Tenant not found' });

    if (name  !== undefined) tenant.name  = name.trim();
    if (phone !== undefined) tenant.phone = phone.trim();
    if (idNumber !== undefined) {
      const cleaned = idNumber && idNumber.trim() ? idNumber.trim() : null;
      if (cleaned && cleaned !== tenant.idNumber) {
        const existing = await Tenant.findOne({ idNumber: cleaned });
        if (existing) return res.status(400).json({ message: 'ID number already in use' });
      }
      tenant.idNumber = cleaned;
    }

    await tenant.save();
    const updated = await Tenant.findById(tenant._id).populate('house');
    return res.json({ message: 'Tenant updated', tenant: updated });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to update tenant', error: err.message });
  }
});

// =====================
// ASSIGN HOUSE
// =====================
router.put('/:id/assign', auth, async (req, res) => {
  try {
    const { houseId } = req.body;
    if (!houseId) return res.status(400).json({ message: 'houseId is required' });

    const tenant   = await Tenant.findById(req.params.id);
    const newHouse = await House.findById(houseId);

    if (!tenant)   return res.status(404).json({ message: 'Tenant not found' });
    if (!newHouse) return res.status(404).json({ message: 'House not found' });

    // Block if the house is already taken by another tenant
    if (newHouse.status === 'occupied' && String(newHouse.tenant) !== String(tenant._id)) {
      return res.status(400).json({ message: 'That house is already occupied by another tenant' });
    }

    // Free old house if tenant is moving to a different one
    if (tenant.house && String(tenant.house) !== String(newHouse._id)) {
      await House.findByIdAndUpdate(tenant.house, { status: 'vacant', tenant: null });
    }

    // Clean up any orphaned links
    await House.updateMany(
      { tenant: tenant._id, _id: { $ne: newHouse._id } },
      { $set: { status: 'vacant', tenant: null } }
    );

    // Assign new house
    tenant.house      = newHouse._id;
    tenant.moveInDate = tenant.moveInDate || new Date();
    tenant.dueDate    = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await tenant.save();

    newHouse.status = 'occupied';
    newHouse.tenant = tenant._id;
    await newHouse.save();

    const updated = await Tenant.findById(tenant._id).populate('house');
    return res.json({ message: 'House assigned successfully', tenant: updated });

  } catch (err) {
    return res.status(500).json({ message: 'Assignment failed', error: err.message });
  }
});

// =====================
// VACATE TENANT (remove from house without deleting tenant)
// =====================
router.put('/:id/vacate', auth, async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.params.id);
    if (!tenant) return res.status(404).json({ message: 'Tenant not found' });

    if (!tenant.house) {
      return res.status(400).json({ message: 'Tenant is not assigned to any house' });
    }

    // Free the house
    await House.findByIdAndUpdate(tenant.house, { status: 'vacant', tenant: null });

    // Also clean any orphan links
    await House.updateMany({ tenant: tenant._id }, { $set: { status: 'vacant', tenant: null } });

    tenant.house    = null;
    tenant.dueDate  = null;
    await tenant.save();

    return res.json({ message: 'Tenant vacated successfully', tenant });

  } catch (err) {
    return res.status(500).json({ message: 'Vacate failed', error: err.message });
  }
});

// =====================
// DELETE TENANT
// =====================
router.delete('/:id', auth, async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.params.id);
    if (!tenant) return res.status(404).json({ message: 'Tenant not found' });

    // Free the house
    if (tenant.house) {
      await House.findByIdAndUpdate(tenant.house, { status: 'vacant', tenant: null });
    }
    await House.updateMany({ tenant: tenant._id }, { $set: { status: 'vacant', tenant: null } });

    await tenant.deleteOne();
    return res.json({ message: 'Tenant deleted successfully' });

  } catch (err) {
    return res.status(500).json({ message: 'Failed to delete tenant', error: err.message });
  }
});

module.exports = router;