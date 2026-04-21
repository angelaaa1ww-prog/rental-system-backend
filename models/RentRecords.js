const mongoose = require('mongoose');

const rentRecordSchema = new mongoose.Schema({
  tenant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Tenant",
    required: true
  },

  house: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "House",
    required: true
  },

  month: {
    type: String,
    required: true
  },

  expectedAmount: {
    type: Number,
    required: true
  },

  status: {
    type: String,
    default: "unpaid" // unpaid | paid
  }
}, { timestamps: true });

module.exports = mongoose.model("RentRecord", rentRecordSchema);