const Transaction = require("../models/Transaction");


// VALIDATION URL
exports.validatePayment = async (req, res) => {

    console.log("VALIDATION BODY:");
    console.log(req.body);

    res.json({
        ResultCode: 0,
        ResultDesc: "Accepted"
    });
};


// CONFIRMATION URL
exports.confirmPayment = async (req, res) => {

    try {

        console.log("CONFIRMATION BODY:");
        console.log(req.body);

        const transaction = new Transaction(req.body);

        await transaction.save();

        res.json({
            ResultCode: 0,
            ResultDesc: "Received Successfully"
        });

    } catch (error) {

        console.log(error);

        res.status(500).json({
            message: "Error saving transaction"
        });

    }

};