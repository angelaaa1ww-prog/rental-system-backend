const express = require('express');
const router = express.Router();
const Tenant = require('../models/Tenant');
const protect = require('../middleware/authMiddleware');

router.post('/', protect, async (req, res) => {
  const t = await Tenant.create(req.body);
  res.json(t);
});

router.get('/', protect, async (req, res) => {
  res.json(await Tenant.find());
});

module.exports = router;