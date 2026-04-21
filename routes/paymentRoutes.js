const express = require('express');
const router = express.Router();

const Payment = require('../models/Payment');
const Tenant = require('../models/Tenant');
const House = require('../models/House');
const RentRecord = require('../models/RentRecord');
const auth = require('../middleware/authMiddleware');


// =====================
// CREATE PAYMENT + MARK RENT PAID
// =====================
router.post('/', auth, async (req, res) => {
  try {
    const { tenant, house, amount, month } = req.body;

    if (!tenant || !house || !amount || !month) {
      return res.status(400).json({
        message: "tenant, house, amount, month required"
      });
    }

    const tenantExists = await Tenant.findById(tenant);
    const houseExists = await House.findById(house);

    if (!tenantExists) return res.status(404).json({ message: "Tenant not found" });
    if (!houseExists) return res.status(404).json({ message: "House not found" });

    const payment = new Payment({
      tenant,
      house,
      amount,
      month
    });

    await payment.save();

    // mark rent as paid
    const record = await RentRecord.findOne({ tenant, month });

    if (record) {
      record.status = "paid";
      await record.save();
    }

    res.json({
      message: "Payment saved successfully",
      payment
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


// =====================
// GET PAYMENTS
// =====================
router.get('/', auth, async (req, res) => {
  try {
    const payments = await Payment.find()
      .populate('tenant')
      .populate('house')
      .sort({ paidAt: -1 });

    res.json(payments);

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;