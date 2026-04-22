const express = require('express');
const router = express.Router();

const House = require('../models/House');
const auth = require('../middleware/authMiddleware');


// =====================
// CREATE HOUSE (FIXED)
// =====================
router.post('/', auth, async (req, res) => {
  try {
    let { houseNumber, location, rent, apartment, bedrooms } = req.body;

    console.log("HOUSE REQUEST:", req.body);

    // FORCE CLEAN TYPES
    rent = Number(rent);
    bedrooms = Number(bedrooms);

    if (!houseNumber || !location || !apartment) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    if (isNaN(rent) || rent <= 0) {
      return res.status(400).json({ message: "Invalid rent value" });
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
      status: "vacant",   // FIXED (consistent with frontend)
      tenant: null
    });

    return res.status(201).json(house);

  } catch (err) {
    console.log("HOUSE CREATE ERROR:", err);

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
    const houses = await House.find().populate('tenant');
    return res.json(houses);
  } catch (err) {
    return res.status(500).json({ message: "Failed to load houses" });
  }
});

module.exports = router;