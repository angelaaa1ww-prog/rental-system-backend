const mongoose = require('mongoose');

const tenantSchema = new mongoose.Schema({
  fullName: String,
  phone: String,
  nationalId: String,
  houseNumber: String,
  monthlyRent: Number,
  deposit: Number,
  status: { type: String, default: "active" }
});

module.exports = mongoose.model('Tenant', tenantSchema);