const mongoose = require('mongoose');

const tenantSchema = new mongoose.Schema(
  {
    name: String,
    phone: String,
    idNumber: { type: String, unique: true },

    house: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "House",
      default: null
    },

    // ⭐ NEW
    dueDate: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Tenant', tenantSchema);