const express = require('express');
const router  = express.Router();
const House   = require('../models/House');
const Tenant  = require('../models/Tenant');
const auth    = require('../middleware/authMiddleware');

// =====================
// CREATE HOUSE
// =====================
router.post('/', auth, async (req, res) => {
  try {
    let { houseNumber, location, rent, apartment, bedrooms } = req.body;

    rent     = Number(rent);
    bedrooms = Number(bedrooms);

    if (!houseNumber || !location || !apartment) {
      return res.status(400).json({ message: 'houseNumber, location and apartment are required' });
    }
    if (isNaN(rent) || rent <= 0) {
      return res.status(400).json({ message: 'Invalid rent value' });
    }
    if (![1,2,3,4].includes(bedrooms)) {
      return res.status(400).json({ message: 'Bedrooms must be 1–4' });
    }

    const exists = await House.findOne({ houseNumber: houseNumber.trim(), apartment: apartment.trim() });
    if (exists) {
      return res.status(400).json({ message: `House ${houseNumber} already exists in Apartment ${apartment}` });
    }

    const house = await House.create({
      houseNumber: houseNumber.trim(),
      location:    location.trim(),
      rent,
      apartment:   apartment.trim(),
      bedrooms,
      status:      'vacant',
      tenant:      null
    });

    return res.status(201).json(house);
  } catch (err) {
    return res.status(500).json({ message: 'Failed to create house', error: err.message });
  }
});

// =====================
// GET ALL HOUSES
// =====================
router.get('/', auth, async (req, res) => {
  try {
    const houses = await House.find().populate('tenant', 'name phone').sort({ apartment: 1, houseNumber: 1 });
    return res.json(houses);
  } catch (err) {
    return res.status(500).json({ message: 'Failed to load houses', error: err.message });
  }
});

// =====================
// GET SINGLE HOUSE
// =====================
router.get('/:id', auth, async (req, res) => {
  try {
    const house = await House.findById(req.params.id).populate('tenant', 'name phone');
    if (!house) return res.status(404).json({ message: 'House not found' });
    return res.json(house);
  } catch (err) {
    return res.status(500).json({ message: 'Failed to load house', error: err.message });
  }
});

// =====================
// UPDATE HOUSE
// =====================
router.put('/:id', auth, async (req, res) => {
  try {
    const { location, rent, bedrooms } = req.body;
    const house = await House.findById(req.params.id);
    if (!house) return res.status(404).json({ message: 'House not found' });

    if (location !== undefined) house.location = location.trim();
    if (rent     !== undefined) {
      const r = Number(rent);
      if (isNaN(r) || r <= 0) return res.status(400).json({ message: 'Invalid rent value' });
      house.rent = r;
    }
    if (bedrooms !== undefined) {
      const b = Number(bedrooms);
      if (![1,2,3,4].includes(b)) return res.status(400).json({ message: 'Bedrooms must be 1–4' });
      house.bedrooms = b;
    }

    await house.save();
    return res.json({ message: 'House updated', house });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to update house', error: err.message });
  }
});

// =====================
// DELETE HOUSE
// =====================
router.delete('/:id', auth, async (req, res) => {
  try {
    const house = await House.findById(req.params.id);
    if (!house) return res.status(404).json({ message: 'House not found' });

    if (house.status === 'occupied') {
      return res.status(400).json({ message: 'Cannot delete an occupied house. Vacate the tenant first.' });
    }

    await house.deleteOne();
    return res.json({ message: 'House deleted successfully' });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to delete house', error: err.message });
  }
});

module.exports = router;