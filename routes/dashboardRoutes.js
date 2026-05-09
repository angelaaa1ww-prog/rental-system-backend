const express = require('express');
const router = express.Router();

const Tenant  = require('../models/Tenant');
const House   = require('../models/House');
const Payment = require('../models/Payment');
const auth    = require('../middleware/authMiddleware');

// =====================
// DASHBOARD SUMMARY
// =====================
router.get('/', auth, async (req, res) => {
  try {
    // ── House stats ──────────────────────────────────────
    const [totalHouses, occupied] = await Promise.all([
      House.countDocuments(),
      House.countDocuments({ status: 'occupied' })
    ]);
    const available     = totalHouses - occupied;
    const occupancyRate = totalHouses === 0
      ? 0
      : Math.round((occupied / totalHouses) * 100);

    // ── Payments — NO status filter (manual payments are confirmed by default) ──
    const payments = await Payment.find({ status: 'confirmed' });
    const totalIncome = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

    const now   = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    const currentMonth = now.toISOString().slice(0, 7);

    // ── This month's income ───────────────────────────────
    const monthlyIncome = payments
      .filter(p => {
        const d = new Date(p.createdAt);
        return d >= start && d <= end;
      })
      .reduce((sum, p) => sum + (p.amount || 0), 0);

    // Build payment map: tenantId → totalPaidTHISMONTH
    const paymentMap = {};
    payments.forEach(p => {
      const isCurrentMonth = p.month === currentMonth || (!p.month && new Date(p.createdAt) >= start && new Date(p.createdAt) <= end);
      if (isCurrentMonth) {
        const id = String(p.tenant);
        paymentMap[id] = (paymentMap[id] || 0) + (p.amount || 0);
      }
    });

    // ── Tenants & overdue ─────────────────────────────────
    const tenants = await Tenant.find({ active: true }).populate('house');
    const overdueTenants = [];

    tenants.forEach(t => {
      if (!t.house) return;
      const rent    = t.house.rent || 0;
      const paid    = paymentMap[String(t._id)] || 0;
      const balance = rent - paid;
      if (balance > 0) {
        overdueTenants.push({
          _id:     t._id,
          name:    t.name,
          phone:   t.phone,
          house:   t.house.houseNumber,
          rent,
          paid,
          balance
        });
      }
    });

    res.json({
      totalHouses,
      occupied,
      available,
      occupancyRate,
      totalIncome,
      monthlyIncome,
      totalTenants: tenants.length,
      overdueCount: overdueTenants.length,
      overdueTenants
    });

  } catch (err) {
    res.status(500).json({ message: 'Dashboard error', error: err.message });
  }
});

module.exports = router;