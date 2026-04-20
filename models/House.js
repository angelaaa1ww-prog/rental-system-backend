const mongoose = require('mongoose');

const houseSchema = new mongoose.Schema({
  houseNumber: { type: String, required: true },
  location: String,
  rent: Number,
  status: { type: String, default: "vacant" },
  tenant: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant", default: null }
}, { timestamps: true });

<<<<<<< HEAD:models/house.js
module.exports = mongoose.model("House", houseSchema);
=======
module.exports = mongoose.model('House', houseSchema);
>>>>>>> f636a40c9ed7c4d53892c2f95c926ddab9a6af72:models/House.js
