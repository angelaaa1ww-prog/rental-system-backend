const mongoose = require("mongoose");

// =============================================
// PAYMENT MODEL
// Handles both:
//   - Manual/cash payments (from paymentRoutes.js)
//   - M-Pesa STK push payments (from mpesaRoutes.js)
// =============================================

const paymentSchema = new mongoose.Schema(
  {
    // Which tenant made this payment
    tenant: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "Tenant",
      required: true,
    },

    // Amount paid in KES
    amount: {
      type:     Number,
      required: true,
    },

    // M-Pesa receipt (e.g. QKA1234XYZ) or manual ref (e.g. PAY-1234567890)
    // Also used to store CheckoutRequestID while payment is still pending
    reference: {
      type: String,
    },

    // pending   → STK push sent, waiting for M-Pesa callback
    // confirmed → Payment received and confirmed
    // failed    → Tenant cancelled or payment failed
    status: {
      type:    String,
      enum:    ["pending", "confirmed", "failed"],
      default: "confirmed", // manual cash payments are instantly confirmed
    },

    // Which month this payment covers e.g. "2025-04"
    // Used to prevent double payments in same month
    month: {
      type:    String,
      default: null,
    },

    // How was this payment made
    paymentMethod: {
      type:    String,
      enum:    ["cash", "mpesa", "bank", "other"],
      default: "cash",
    },

    // M-Pesa receipt number after callback confirms payment
    // e.g. QKA1234XYZ
    mpesaReceipt: {
      type:    String,
      default: null,
    },

    // Optional note from admin e.g. "Partial payment", "Arrears"
    note: {
      type:    String,
      default: "",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Payment", paymentSchema);