const express  = require('express');
const router   = express.Router();
const Tenant   = require('../models/Tenant');
const Payment  = require('../models/Payment');
const auth     = require('../middleware/authMiddleware');

// =====================
// GET OVERDUE REMINDERS
// =====================
router.get('/', auth, async (req, res) => {
  try {
    const tenants = await Tenant.find({ active: true }).populate('house');

    // Batch all payments in ONE query (fixes N+1 bug)
    const allPayments = await Payment.find({ status: 'confirmed' });
    const paymentMap  = {};
    allPayments.forEach(p => {
      const id = String(p.tenant);
      paymentMap[id] = (paymentMap[id] || 0) + (p.amount || 0);
    });

    const today     = new Date();
    const reminders = [];

    for (const t of tenants) {
      if (!t.house) continue;

      const rent    = t.house.rent || 0;
      const paid    = paymentMap[String(t._id)] || 0;
      const balance = rent - paid;

      if (balance <= 0) continue;

      const daysLeft = t.dueDate
        ? Math.ceil((new Date(t.dueDate) - today) / (1000 * 60 * 60 * 24))
        : -1;

      reminders.push({
        _id:      t._id,
        name:     t.name,
        phone:    t.phone,
        house:    t.house.houseNumber,
        rent,
        paid,
        balance,
        daysLeft,
        message:  daysLeft < 0
          ? `Overdue by ${Math.abs(daysLeft)} day(s). Balance: KES ${balance.toLocaleString()}`
          : `Due in ${daysLeft} day(s). Balance: KES ${balance.toLocaleString()}`
      });
    }

    return res.json(reminders);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

module.exports = router;