const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema({
    tenant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Tenant",
        default: null
    },
    payment: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Payment",
        default: null
    },
    status: {
        type: String,
        enum: ["received", "linked", "unmatched", "duplicate", "failed"],
        default: "received"
    },
    matchType: {
        type: String,
        default: null
    },
    transactionType: String,
    transID: String,
    transTime: String,
    transAmount: Number,
    businessShortCode: String,
    billRefNumber: String,
    invoiceNumber: String,
    orgAccountBalance: String,
    thirdPartyTransID: String,
    msisdn: String,
    firstName: String,
    middleName: String,
    lastName: String,
    raw: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    }
}, { timestamps: true });

transactionSchema.index({ transID: 1 });
transactionSchema.index({ billRefNumber: 1 });
transactionSchema.index({ msisdn: 1 });

module.exports = mongoose.model("Transaction", transactionSchema);
