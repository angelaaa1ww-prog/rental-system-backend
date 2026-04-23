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

    const payment = await Payment.create({
      tenant:        tenantId,
      amount:        amt,
      reference:     reference || `PAY-${Date.now()}`,
      status:        'confirmed',   // manual payments are instantly confirmed
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
      .populate('tenant', 'name phone')
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

    const payments = await Payment.find({
      tenant: req.params.tenantId,
      status: 'confirmed'
    });
    const paid    = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const balance = Math.max(0, rent - paid);

    return res.json({ rent, paid, balance });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to compute balance', error: err.message });
  }
});

// =====================
// DELETE PAYMENT
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