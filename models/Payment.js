const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    tenant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true
    },

    amount: {
      type: Number,
      required: true
    },

    reference: {
      type: String,
      required: true
    },

    status: {
      type: String,
      enum: ["pending", "confirmed", "failed"],
      default: "pending"
    },

    mpesaReceipt: {
      type: String,
      default: null
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Payment", paymentSchema);