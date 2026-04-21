const mongoose = require('mongoose');

const houseSchema = new mongoose.Schema({
  houseNumber: {
    type: String,
    required: true
  },
  location: {
    type: String,
    required: true
  },
  rent: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    default: "available"
  },
  tenant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Tenant",
    default: null
  }
}, { timestamps: true });

module.exports = mongoose.model('House', houseSchema);
