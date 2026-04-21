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

  // ✅ STRICT + CLEAN STATUS CONTROL
  status: {
    type: String,
    enum: ["available", "occupied"],
    default: "available",
    lowercase: true,
    trim: true
  },

  tenant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Tenant",
    default: null
  }

}, { timestamps: true });

module.exports = mongoose.model('House', houseSchema);