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
    required: true
  },
  month: {
    type: String,
    required: true
  },
  status: {
    type: String,
    default: "paid"
  }
}, { timestamps: true });

module.exports = mongoose.model("Payment", paymentSchema);