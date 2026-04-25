const mongoose = require("mongoose");

// =============================================
// PAYMENT MODEL (PRODUCTION READY)
// =============================================

const paymentSchema = new mongoose.Schema(
  {
    tenant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
    },

    amount: {
      type: Number,
      required: true,
    },

    // M-Pesa receipt OR CheckoutRequestID (for tracking)
    reference: {
      type: String,
      required: true,
    },

    // STATUS FLOW
    status: {
      type: String,
      enum: ["pending", "confirmed", "failed"],
      default: "pending",
    },

    // 🔥 NEW: Month tracking (VERY IMPORTANT for rent system)
    // format: "2026-04"
    month: {
      type: String,
      required: true,
    },

    // 🔥 NEW: final M-Pesa receipt number (after callback success)
    mpesaReceipt: {
      type: String,
    },

    // optional safety fields (useful later for SMS/logs)
    phone: {
      type: String,
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Payment", paymentSchema);