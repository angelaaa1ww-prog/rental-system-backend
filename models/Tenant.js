const mongoose = require('mongoose');

const tenantSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },

    phone: {
      type: String,
      required: true,
      trim: true
    },

    idNumber: {
      type: String,
      trim: true,
      sparse: true,
      unique: true,
      default: null
    },

    house: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'House',
      default: null
    },

    // when rent is due next
    dueDate: {
      type: Date,
      default: null
    },

    moveInDate: {
      type: Date,
      default: null
    },

    active: {
      type: Boolean,
      default: true
    },

    // 🔥 NEW: monthly rent amount stored per tenant
    rentAmount: {
      type: Number,
      default: 0
    },

    // 🔥 NEW: last paid month (prevents duplicate rent)
    lastPaidMonth: {
      type: String,
      default: null // format: "2026-04"
    }

  },
  { timestamps: true }
);

module.exports = mongoose.model('Tenant', tenantSchema);