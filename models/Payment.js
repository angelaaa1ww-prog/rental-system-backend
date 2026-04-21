const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  tenant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Tenant"
  },
  house: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "House"
  },
  amount: {
    type: Number,
    required: true
  },
  month: String
}, { timestamps: true });

module.exports = mongoose.model('Payment', paymentSchema);