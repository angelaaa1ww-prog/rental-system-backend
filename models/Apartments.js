const mongoose = require('mongoose');

const apartmentSchema = new mongoose.Schema({
  name: {
    type: String,
    enum: ["A", "B", "C", "D", "E"],
    required: true,
    unique: true
  },

  location: {
    type: String,
    default: "Not set"
  },

  description: {
    type: String,
    default: ""
  }
}, { timestamps: true });

module.exports = mongoose.model('Apartment', apartmentSchema);