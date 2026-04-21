const mongoose = require('mongoose');

const houseSchema = new mongoose.Schema(
  {
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

    apartment: {
      type: String,
      enum: ["A", "B", "C", "D", "E"],
      required: true
    },

    bedrooms: {
      type: Number,
      enum: [1, 2, 3, 4],
      required: true
    },

    rent: {
      type: Number,
      required: true
    },

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
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('House', houseSchema);