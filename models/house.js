const mongoose = require('mongoose');

const houseSchema = new mongoose.Schema({
  houseNumber: { type: String, required: true },
  location: String,
  rent: Number,
  status: { type: String, default: "vacant" },
  tenant: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant", default: null }
}, { timestamps: true });

module.exports = mongoose.model("House", houseSchema);