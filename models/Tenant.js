const mongoose = require('mongoose');

const tenantSchema = new mongoose.Schema({
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
    required: true,
    trim: true
  },

  house: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "House",
    default: null
  },

  // 🔥 FIX: lock allowed values
  status: {
    type: String,
    enum: ["active", "inactive"],
    default: "active"
  }

}, { timestamps: true });

module.exports = mongoose.model("Tenant", tenantSchema);