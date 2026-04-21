const mongoose = require('mongoose');

const tenantSchema = new mongoose.Schema(
  {
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
      trim: true,
      unique: true // ✅ prevents duplicate tenants by ID number
    },

    house: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "House",
      default: null
    }
  },
  {
    timestamps: true
  }
);

// optional safety index (helps performance)
tenantSchema.index({ idNumber: 1 });

module.exports = mongoose.model('Tenant', tenantSchema);