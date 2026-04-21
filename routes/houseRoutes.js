const express = require('express');
const router = express.Router();

const House = require('../models/House');
const auth = require('../middleware/authMiddleware');


// =====================
// GET ALL HOUSES
// =====================
router.get('/', auth, async (req, res) => {
  try {
    const houses = await House.find().sort({ createdAt: -1 });
    res.json(houses);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


// =====================
// CREATE HOUSE (VALIDATED)
// =====================
router.post('/', auth, async (req, res) => {
  try {
    const { houseNumber, location, rent } = req.body;

    // 🔥 VALIDATION
    if (!houseNumber || !location || !rent) {
      return res.status(400).json({
        message: "houseNumber, location, rent are required"
      });
    }

    // 🔥 PREVENT DUPLICATES
    const exists = await House.findOne({ houseNumber });
    if (exists) {
      return res.status(400).json({
        message: "House number already exists"
      });
    }

    const house = new House({
      houseNumber,
      location,
      rent,
      status: "available",
      tenant: null
    });

    const saved = await house.save();
    res.json(saved);

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


// =====================
// UPDATE HOUSE
// =====================
router.put('/:id', auth, async (req, res) => {
  try {
    const updated = await House.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ message: "House not found" });
    }

    res.json(updated);

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;