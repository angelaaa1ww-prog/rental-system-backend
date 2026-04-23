const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    tenant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true
    },

    amount: {
      type: Number,
      required: true,
      min: 1
    },

    reference: {
      type: String,
      default: ''
    },

    // 'confirmed' for manual cash, updated by MPESA callback
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'failed'],
      default: 'confirmed'
    },

    paymentMethod: {
      type: String,
      enum: ['cash', 'mpesa', 'bank', 'other'],
      default: 'cash'
    },

    // Populated by MPESA callback
    mpesaReceipt: {
      type: String,
      default: null
    },

    note: {
      type: String,
      default: ''
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Payment', paymentSchema);