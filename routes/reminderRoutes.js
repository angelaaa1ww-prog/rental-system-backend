const express = require('express');
const router = express.Router();

const Tenant = require('../models/Tenant');
const Payment = require('../models/Payment');
const auth = require('../middleware/authMiddleware');

router.get('/', auth, async (req, res) => {
  try {
    const tenants = await Tenant.find().populate('house');

    const today = new Date();

    const reminders = [];

    for (let t of tenants) {
      if (!t.house || !t.dueDate) continue;

      const rent = t.house.rent;

      const payments = await Payment.find({ tenant: t._id });
      const paid = payments.reduce((sum, p) => sum + p.amount, 0);

      const balance = rent - paid;

      const daysLeft =
        Math.ceil((t.dueDate - today) / (1000 * 60 * 60 * 24));

      if (daysLeft <= 10 && balance > 0) {
        reminders.push({
          name: t.name,
          message: `Due in ${daysLeft} days. Balance: ${balance}`
        });
      }
    }

    res.json(reminders);

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;