const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant' },
  amount: Number,
  month: String,
  date: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Payment', paymentSchema);