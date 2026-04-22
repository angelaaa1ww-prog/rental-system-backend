const mongoose = require('mongoose');

const smsLogSchema = new mongoose.Schema(
  {
    phone: String,
    message: String,
    status: {
      type: String,
      default: "pending" // pending | sent | failed
    },
    cost: String,
    messageId: String,
    tenant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant"
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('SmsLog', smsLogSchema);