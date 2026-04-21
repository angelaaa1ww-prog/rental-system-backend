const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  tenant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Tenant",
    required: true
  },

  house: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "House",
    required: true
  },

  amount: {
    type: Number,
    required: true,
    min: 0
  },

  month: {
    type: String,
    required: true,
    trim: true
  },

  paidAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("Payment", paymentSchema);