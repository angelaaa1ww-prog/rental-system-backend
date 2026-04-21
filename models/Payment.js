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

  month: {
    type: String,
    required: true
  },

  rentExpected: {
    type: Number,
    required: true
  },

  amountPaid: {
    type: Number,
    required: true
  },

  balance: {
    type: Number,
    required: true
  },

  status: {
    type: String,
    enum: ["paid", "partial", "unpaid"],
    default: "partial"
  },

  mpesaCode: {
    type: String,
    default: null
  }

}, { timestamps: true });

module.exports = mongoose.model("Payment", paymentSchema);