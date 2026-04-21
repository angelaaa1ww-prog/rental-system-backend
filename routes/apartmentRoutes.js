const express = require('express');
const router = express.Router();

const Apartment = require('../models/Apartment');
const auth = require('../middleware/authMiddleware');

// CREATE apartments A–E (one-time setup)
router.post('/seed', auth, async (req, res) => {
  try {
    const names = ["A", "B", "C", "D", "E"];

    for (let name of names) {
      const exists = await Apartment.findOne({ name });
      if (!exists) {
        await Apartment.create({ name });
      }
    }

    res.json({ message: "Apartments seeded successfully" });

  } catch (err) {
    res.status(500).json({
      message: "Failed to seed apartments",
      error: err.message
    });
  }
});

// GET ALL APARTMENTS
router.get('/', auth, async (req, res) => {
  try {
    const apartments = await Apartment.find();
    res.json(apartments);
  } catch (err) {
    res.status(500).json({
      message: "Failed to load apartments",
      error: err.message
    });
  }
});

module.exports = router;