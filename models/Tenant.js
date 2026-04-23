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

    // sparse: true allows multiple documents to have null/missing idNumber
    idNumber: {
      type: String,
      trim: true,
      sparse: true,
      unique: true,
      default: null
    },

    house: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'House',
      default: null
    },

    // Date rent is next due — set when house is assigned
    dueDate: {
      type: Date,
      default: null
    },

    // Date tenant moved in
    moveInDate: {
      type: Date,
      default: null
    },

    // Soft-delete / active flag
    active: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Tenant', tenantSchema);