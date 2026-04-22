const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    tenant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true
    },

    amount: {
      type: Number,
      required: true,
      min: 1
    },

    reference: {
      type: String,
      required: true,
      unique: true,
      index: true
    },

    status: {
      type: String,
      enum: ["pending", "confirmed", "failed"],
      default: "pending",
      index: true
    },

    mpesaReceipt: {
      type: String,
      default: null,
      index: true
    },

    phone: {
      type: String,
      default: null
    }
  },
  { timestamps: true }
);

// Prevent duplicate reference entries (important for STK safety)
paymentSchema.index({ reference: 1 }, { unique: true });

module.exports = mongoose.model("Payment", paymentSchema);