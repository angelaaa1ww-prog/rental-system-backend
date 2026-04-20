const express = require('express');
const router = express.Router();

const Tenant = require('../models/Tenant');
const House = require('../models/House');
const Payment = require('../models/Payment');
const auth = require('../middleware/auth');

router.get('/', auth, async (req, res) => {
  try {
    const totalTenants = await Tenant.countDocuments();
    const totalHouses = await House.countDocuments();
    const occupiedHouses = await House.countDocuments({ status: "occupied" });
    const vacantHouses = await House.countDocuments({ status: "vacant" });

    const payments = await Payment.find();
    const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0);

    res.json({
      totalTenants,
      totalHouses,
      occupiedHouses,
      vacantHouses,
      totalRevenue
    });

  } catch (err) {
    res.status(500).json(err);
  }
});

module.exports = router;