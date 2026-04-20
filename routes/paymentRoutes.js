const express = require('express');
const router = express.Router();
const Payment = require('../models/Payment');
const protect = require('../middleware/authMiddleware');

router.post('/', protect, async (req, res) => {
  res.json(await Payment.create(req.body));
});

router.get('/', protect, async (req, res) => {
  res.json(await Payment.find().populate('tenant'));
});

module.exports = router;