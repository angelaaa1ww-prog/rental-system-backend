const express = require('express');
const router = express.Router();

const Payment = require('../models/Payment');
const Tenant = require('../models/Tenant');
const auth = require('../middleware/authMiddleware');


// =====================
// UNPAID / OVERDUE REPORT
// =====================
router.get('/unpaid', auth, async (req, res) => {
  try {
    const tenants = await Tenant.find().populate('house');

    const payments = await Payment.find();

    const report = tenants.map(tenant => {
      const tenantPayments = payments.filter(
        p => p.tenant.toString() === tenant._id.toString()
      );

      const lastPayment = tenantPayments.sort(
        (a, b) => new Date(b.paidAt) - new Date(a.paidAt)
      )[0];

      return {
        tenant: tenant.name,
        phone: tenant.phone,
        house: tenant.house?.houseNumber || "NOT ASSIGNED",
        lastPaidMonth: lastPayment?.month || "NEVER PAID",
        lastPaidAmount: lastPayment?.amount || 0
      };
    });

    res.json(report);

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;