const express = require('express');
const router = express.Router();

const House = require('../models/House');
const auth = require('../middleware/authMiddleware');

// CREATE HOUSE
router.post('/', auth, async (req, res) => {
  try {
    const { houseNumber, location, rent, apartment, bedrooms } = req.body;

    if (!houseNumber || !location || !rent || !apartment || !bedrooms) {
      return res.status(400).json({ message: "All fields required" });
    }

    const exists = await House.findOne({ houseNumber, apartment });

    if (exists) {
      return res.status(400).json({ message: "House already exists" });
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

    res.status(201).json(house);

  } catch (err) {
    res.status(500).json({
      message: "Failed to create house",
      error: err.message
    });
  }
});

// GET ALL HOUSES
router.get('/', auth, async (req, res) => {
  try {
    const houses = await House.find().populate('tenant');
    res.json(houses);
  } catch (err) {
    res.status(500).json({ message: "Failed to load houses" });
  }
});

module.exports = router;