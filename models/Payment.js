const mongoose = require("mongoose");

// =============================================
// UPDATED PAYMENT MODEL
// Added: status field (pending | confirmed | failed)
// This is needed for Daraja STK push flow
// =============================================

const paymentSchema = new mongoose.Schema(
  {
    tenant: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "Tenant",
      required: true,
    },

    amount: {
      type:     Number,
      required: true,
    },

    // M-Pesa receipt (e.g. QKA1234XYZ) or CheckoutRequestID while pending
    reference: {
      type: String,
    },

    // pending → waiting for M-Pesa callback
    // confirmed → Safaricom confirmed payment
    // failed → tenant cancelled or payment failed
    status: {
      type:    String,
      enum:    ["pending", "confirmed", "failed"],
      default: "confirmed",   // manual payments stay confirmed
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Payment", paymentSchema);