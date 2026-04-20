const mongoose = require('mongoose');

const tenantSchema = new mongoose.Schema({
  name: String,
  phone: String,
  idNumber: String,
  house: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "House",
    default: null
  },
  status: { type: String, default: "active" }
}, { timestamps: true });

module.exports = mongoose.model("Tenant", tenantSchema);