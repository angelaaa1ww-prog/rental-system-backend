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
      enum: ["vacant", "occupied"],
      default: "vacant"
    },

    tenant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      default: null
    }
  },
  { timestamps: true }
);

/**
 * FIXED:
 * Ensures houseNumber is unique ONLY inside each apartment
 * (A-001 can exist, B-001 can exist)
 */
houseSchema.index(
  { houseNumber: 1, apartment: 1 },
  { unique: true }
);

module.exports = mongoose.model("House", houseSchema);