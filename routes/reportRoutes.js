const express = require('express');
const router = express.Router();

const Tenant = require('../models/Tenant');
const Payment = require('../models/Payment');
const auth = require('../middleware/auth');

// GET TENANTS WITH NO PAYMENT FOR A MONTH
router.get('/arrears/:month', auth, async (req, res) => {
  try {
    const { month } = req.params;

    const tenants = await Tenant.find();

    const payments = await Payment.find({ month });

    const paidTenantIds = payments.map(p => p.tenant.toString());

    const arrears = tenants.filter(t =>
      !paidTenantIds.includes(t._id.toString())
    );

    res.json(arrears);
  } catch (err) {
    res.status(500).json(err);
  }
});

module.exports = router;