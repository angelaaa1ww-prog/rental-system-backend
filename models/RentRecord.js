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
    required: true,
    trim: true
  },

  expectedAmount: {
    type: Number,
    required: true,
    default: 0
  },

  status: {
    type: String,
    enum: ["unpaid", "paid"],
    default: "unpaid"
  },

  paidAt: {
    type: Date,
    default: null
  }

}, { timestamps: true });

module.exports = mongoose.model("RentRecord", rentRecordSchema);