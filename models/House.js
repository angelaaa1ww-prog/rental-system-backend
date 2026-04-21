const mongoose = require('mongoose');

const houseSchema = new mongoose.Schema({
  houseNumber: {
    type: String,
    required: true,
    trim: true
  },

  location: {
    type: String,
    required: true,
    trim: true
  },

  rent: {
    type: Number,
    required: true
  },

  // 🔥 FIX: enforce strict allowed values
  status: {
    type: String,
    enum: ["available", "occupied"],
    default: "available"
  },

  tenant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Tenant",
    default: null
  }

}, { timestamps: true });

module.exports = mongoose.model('House', houseSchema);