const express = require('express');
const router = express.Router();

const Tenant = require('../models/Tenant');
const House = require('../models/House');
const Payment = require('../models/Payment');

router.get('/', async (req, res) => {
  const tenants = await Tenant.countDocuments();
  const houses = await House.countDocuments();

  const payments = await Payment.find();
  const income = payments.reduce((s, p) => s + p.amount, 0);

  res.json({
    tenants,
    houses,
    income
  });
});

module.exports = router;      