const express = require('express');
const router = express.Router();

const House = require('../models/House');
const auth = require('../middleware/authMiddleware');


// =====================
// CREATE HOUSE
// =====================
router.post('/', auth, async (req, res) => {
  try {
    const { houseNumber, location, rent } = req.body;

    if (!houseNumber || !location || !rent) {
      return res.status(400).json({ message: "All fields required" });
    }

    const exists = await House.findOne({ houseNumber });

    if (exists) {
      return res.status(400).json({ message: "House already exists" });
    }

    const house = await House.create({
      houseNumber,
      location,
      rent,
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
// GET ALL HOUSES (SAFE)
// =====================
router.get('/', auth, async (req, res) => {
  try {
    const houses = await House.find()
      .populate('tenant')
      .sort({ createdAt: -1 });

    return res.status(200).json(houses || []);

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

    return res.status(200).json(houses || []);

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

    const allowed = ["houseNumber", "location", "rent"];

    allowed.forEach(field => {
      if (req.body[field] !== undefined) {
        house[field] = req.body[field];
      }
    });

    await house.save();

    return res.status(200).json(house);

  } catch (err) {
    return res.status(500).json({
      message: "Failed to update house",
      error: err.message
    });
  }
});


// =====================
// DELETE HOUSE (SAFE)
// =====================
router.delete('/:id', auth, async (req, res) => {
  try {
    const house = await House.findById(req.params.id);

    if (!house) {
      return res.status(404).json({ message: "House not found" });
    }

    // safety rule: don't delete occupied house
    if (house.status === "occupied") {
      return res.status(400).json({
        message: "Cannot delete occupied house"
      });
    }

    await house.deleteOne();

    return res.status(200).json({
      message: "House deleted successfully"
    });

  } catch (err) {
    return res.status(500).json({
      message: "Failed to delete house",
      error: err.message
    });
  }
});

module.exports = router;