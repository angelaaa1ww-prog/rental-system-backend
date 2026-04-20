const express = require('express');
const router = express.Router();
const House = require('../models/House');
const protect = require('../middleware/authMiddleware');

router.post('/', protect, async (req, res) => {
  res.json(await House.create(req.body));
});

router.get('/', protect, async (req, res) => {
  res.json(await House.find());
});

module.exports = router;