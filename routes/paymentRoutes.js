const express  = require('express');
const router   = express.Router();
const Payment  = require('../models/Payment');
const Tenant   = require('../models/Tenant');
const auth     = require('../middleware/authMiddleware');

// =====================
// CREATE PAYMENT
// =====================
router.post('/', auth, async (req, res) => {
  try {
    const { tenantId, amount, reference, paymentMethod, note } = req.body;

    if (!tenantId || !amount) {
      return res.status(400).json({ message: 'tenantId and amount are required' });
    }

    const amt = Number(amount);
    if (isNaN(amt) || amt <= 0) {
      return res.status(400).json({ message: 'Amount must be a positive number' });
    }

    const tenant = await Tenant.findById(tenantId);
    if (!tenant) {
      return res.status(404).json({ message: 'Tenant not found' });
    }

    const month = new Date().toISOString().slice(0, 7); // e.g. "2025-04"

    const payment = await Payment.create({
      tenant:        tenantId,
      amount:        amt,
      reference:     reference || `PAY-${Date.now()}`,
      status:        'confirmed',   // manual payments are instantly confirmed
      month:         month,
      paymentMethod: paymentMethod || 'cash',
      note:          note || ''
    });

    const populated = await Payment.findById(payment._id).populate('tenant', 'name phone');

    return res.status(201).json({ message: 'Payment recorded', payment: populated });

  } catch (err) {
    return res.status(500).json({ message: 'Payment failed', error: err.message });
  }
});

// =====================
// GET ALL PAYMENTS
// =====================
router.get('/', auth, async (req, res) => {
  try {
    const payments = await Payment.find()
      .populate({
        path: 'tenant',
        select: 'name phone house idNumber',
        populate: { path: 'house', select: 'houseNumber apartment rent' }
      })
      .sort({ createdAt: -1 });

    return res.json(payments || []);
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch payments', error: err.message });
  }
});

// =====================
// GET TENANT BALANCE
// =====================
router.get('/balance/:tenantId', auth, async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.params.tenantId).populate('house');
    if (!tenant) return res.status(404).json({ message: 'Tenant not found' });

    const rent = tenant.house ? Number(tenant.house.rent) : 0;
    const currentMonth = new Date().toISOString().slice(0, 7);

    // Only count payments made in the current month (or those without a month created this month for backwards compatibility)
    const startDate = new Date(`${currentMonth}-01T00:00:00.000Z`);
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 1);

    const payments = await Payment.find({
      tenant: req.params.tenantId,
      status: 'confirmed',
      $or: [
        { month: currentMonth },
        { month: null, createdAt: { $gte: startDate, $lt: endDate } }
      ]
    });
    const paid    = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const balance = Math.max(0, rent - paid);

    return res.json({ rent, paid, balance });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to compute balance', error: err.message });
  }
});

// =====================
// GET ALL BALANCES (BULK)
// =====================
router.get('/balances', auth, async (req, res) => {
  try {
    const tenants = await Tenant.find({ active: true }).populate('house');
    const currentMonth = new Date().toISOString().slice(0, 7);
    const startDate = new Date(`${currentMonth}-01T00:00:00.000Z`);
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 1);

    const payments = await Payment.find({
      status: 'confirmed',
      $or: [
        { month: currentMonth },
        { month: null, createdAt: { $gte: startDate, $lt: endDate } }
      ]
    });

    const paymentMap = {};
    payments.forEach(p => {
      const id = String(p.tenant);
      paymentMap[id] = (paymentMap[id] || 0) + (Number(p.amount) || 0);
    });

    const results = {};
    tenants.forEach(t => {
      const rent = t.house ? Number(t.house.rent) : 0;
      const paid = paymentMap[String(t._id)] || 0;
      results[t._id] = { rent, paid, balance: Math.max(0, rent - paid) };
    });

    return res.json(results);
  } catch (err) {
    return res.status(500).json({ message: 'Failed to compute bulk balances', error: err.message });
  }
});

// =====================
// CLEAR / BULK DELETE PAYMENTS
// =====================
router.post('/bulk-delete', auth, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'Array of payment ids is required' });
    }
    await Payment.deleteMany({ _id: { $in: ids } });
    return res.json({ message: `Successfully deleted ${ids.length} payment records` });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to delete selected payments', error: err.message });
  }
});

router.delete('/clear/all', auth, async (req, res) => {
  try {
    await Payment.deleteMany({});
    return res.json({ message: 'All payment history cleared successfully' });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to clear payment records', error: err.message });
  }
});

// =====================
// DELETE SINGLE PAYMENT
// =====================
router.delete('/:id', auth, async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id);
    if (!payment) return res.status(404).json({ message: 'Payment not found' });

    await payment.deleteOne();
    return res.json({ message: 'Payment deleted' });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to delete payment', error: err.message });
  }
});

module.exports = router;