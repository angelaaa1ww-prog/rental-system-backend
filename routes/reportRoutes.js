const express  = require('express');
const router   = express.Router();
const Payment  = require('../models/Payment');
const auth     = require('../middleware/authMiddleware');

// =====================
// MONTHLY REPORT
// =====================
router.get('/monthly', auth, async (req, res) => {
  try {
    const { month, year } = req.query;
    if (!month || !year) return res.status(400).json({ message: 'month and year are required' });

    const m = parseInt(month, 10);
    const y = parseInt(year,  10);
    if (isNaN(m) || m < 1 || m > 12) return res.status(400).json({ message: 'Invalid month' });
    if (isNaN(y) || y < 2000)        return res.status(400).json({ message: 'Invalid year'  });

    const start = new Date(y, m - 1, 1);
    const end   = new Date(y, m,     0, 23, 59, 59);

    const payments = await Payment.find({
      status:    'confirmed',
      createdAt: { $gte: start, $lte: end }
    }).populate('tenant', 'name phone');

    const totalIncome = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

    const tenantMap = {};
    payments.forEach(p => {
      const id   = String(p.tenant?._id || p.tenant);
      const name = p.tenant?.name || 'Unknown';
      if (!tenantMap[id]) tenantMap[id] = { name, phone: p.tenant?.phone || '', total: 0, count: 0 };
      tenantMap[id].total += p.amount;
      tenantMap[id].count += 1;
    });

    return res.json({
      month: m, year: y, totalIncome,
      transactions: payments.length,
      breakdown: Object.values(tenantMap)
    });
  } catch (err) {
    return res.status(500).json({ message: 'Report error', error: err.message });
  }
});

// =====================
// ANNUAL SUMMARY
// =====================
router.get('/annual', auth, async (req, res) => {
  try {
    const y     = parseInt(req.query.year || new Date().getFullYear(), 10);
    const start = new Date(y, 0,  1);
    const end   = new Date(y, 11, 31, 23, 59, 59);

    const payments = await Payment.find({ status: 'confirmed', createdAt: { $gte: start, $lte: end } });
    const monthly  = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, income: 0, transactions: 0 }));

    payments.forEach(p => {
      const idx = new Date(p.createdAt).getMonth();
      monthly[idx].income       += p.amount || 0;
      monthly[idx].transactions += 1;
    });

    return res.json({
      year,
      totalIncome:   payments.reduce((s, p) => s + (p.amount || 0), 0),
      totalPayments: payments.length,
      monthly
    });
  } catch (err) {
    return res.status(500).json({ message: 'Annual report error', error: err.message });
  }
});

module.exports = router;