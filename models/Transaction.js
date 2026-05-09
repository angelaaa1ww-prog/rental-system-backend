const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema({
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
    lastName: String
}, { timestamps: true });

module.exports = mongoose.model("Transaction", transactionSchema);