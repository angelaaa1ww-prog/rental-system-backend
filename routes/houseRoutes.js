const express = require('express');
const router = express.Router();

const House = require('../models/House');
const auth = require('../middleware/authMiddleware');


// =====================
// CREATE HOUSE
// =====================
router.post('/', auth, async (req, res) => {
  try {
    const { houseNumber, location, rent, apartment, bedrooms } = req.body;

    if (!houseNumber || !location || !rent || !apartment || !bedrooms) {
      return res.status(400).json({ message: "All fields required" });
    }

    const exists = await House.findOne({ houseNumber, apartment });

    if (exists) {
      return res.status(400).json({ message: "House already exists in this apartment" });
    }

    const house = await House.create({
      houseNumber,
      location,
      rent,
      apartment,
      bedrooms,
      status: "available",
      tenant: null
    });

    return res.status(201).json(house);

  } catch (err) {
    return res.status(500).json({
      message: "Failed to create house",
      error: err.message
    });
  }
});


// =====================
// GET ALL HOUSES
// =====================
router.get('/', auth, async (req, res) => {
  try {
    const houses = await House.find()
      .populate('tenant')
      .sort({ apartment: 1, houseNumber: 1 });

    return res.json(houses || []);
  } catch (err) {
    return res.status(500).json({
      message: "Failed to load houses",
      error: err.message
    });
  }
});


// =====================
// GET AVAILABLE HOUSES
// =====================
router.get('/available', auth, async (req, res) => {
  try {
    const houses = await House.find({ status: "available" });

    return res.json(houses || []);
  } catch (err) {
    return res.status(500).json({
      message: "Failed to load available houses",
      error: err.message
    });
  }
});


// =====================
// UPDATE HOUSE
// =====================
router.put('/:id', auth, async (req, res) => {
  try {
    const house = await House.findById(req.params.id);

    if (!house) {
      return res.status(404).json({ message: "House not found" });
    }

    const fields = ["houseNumber", "location", "rent", "apartment", "bedrooms"];

    fields.forEach(f => {
      if (req.body[f] !== undefined) {
        house[f] = req.body[f];
      }
    });

    await house.save();

    return res.json(house);

  } catch (err) {
    return res.status(500).json({
      message: "Failed to update house",
      error: err.message
    });
  }
});


// =====================
// DELETE HOUSE
// =====================
router.delete('/:id', auth, async (req, res) => {
  try {
    const house = await House.findById(req.params.id);

    if (!house) {
      return res.status(404).json({ message: "House not found" });
    }

    if (house.status === "occupied") {
      return res.status(400).json({ message: "Cannot delete occupied house" });
    }

    await house.deleteOne();

    return res.json({ message: "House deleted successfully" });

  } catch (err) {
    return res.status(500).json({
      message: "Failed to delete house",
      error: err.message
    });
  }
});

module.exports = router;