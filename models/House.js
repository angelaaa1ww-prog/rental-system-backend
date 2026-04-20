const mongoose = require('mongoose');

const houseSchema = new mongoose.Schema({
  houseNumber: { type: String, unique: true },
  location: String,
  rent: Number,
  status: { type: String, default: "vacant" },
  tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', default: null }
});

module.exports = mongoose.model('House', houseSchema);
