const express = require('express');
const router = express.Router();

const Tenant = require('../models/Tenant');
const Payment = require('../models/Payment');

router.get('/', async (req, res) => {
  const tenants = await Tenant.find();

  const data = await Promise.all(
    tenants.map(async (t) => {
      const payments = await Payment.find({ tenant: t._id });

      const paid = payments.reduce((s, p) => s + p.amount, 0);
      const expected = t.monthlyRent * (payments.length || 1);

      return {
        tenant: t.fullName,
        house: t.houseNumber,
        balance: expected - paid
      };
    })
  );

  res.json(data);
});

module.exports = router;