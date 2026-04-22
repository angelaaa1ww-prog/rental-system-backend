const express = require('express');
const router = express.Router();

const Payment = require('../models/Payment');
const sendSMS = require('../utils/sms');


// =====================
// M-PESA CALLBACK
// =====================
router.post('/stk', async (req, res) => {
  try {
    const callback = req.body;

    console.log("📩 MPESA CALLBACK:", JSON.stringify(callback, null, 2));

    // Extract result
    const result = callback.Body?.stkCallback;

    if (!result) {
      return res.status(200).json({ message: "No callback data" });
    }

    const reference = result.CheckoutRequestID;
    const resultCode = result.ResultCode;

    // =====================
    // PAYMENT SUCCESSFUL
    // =====================
    if (resultCode === 0) {
      const metadata = result.CallbackMetadata?.Item || [];

      const amount = metadata.find(i => i.Name === "Amount")?.Value;
      const receipt = metadata.find(i => i.Name === "MpesaReceiptNumber")?.Value;
      const phone = metadata.find(i => i.Name === "PhoneNumber")?.Value;

      const payment = await Payment.findOne({ reference });

      if (payment) {
        payment.status = "confirmed";
        payment.mpesaReceipt = receipt;
        await payment.save();

        await sendSMS(
          phone,
          `Payment successful. Receipt: ${receipt}. Amount: KES ${amount}. Thank you.`
        );
      }
    }

    // =====================
    // PAYMENT FAILED
    // =====================
    else {
      await Payment.findOneAndUpdate(
        { reference },
        { status: "failed" }
      );
    }

    return res.status(200).json({ message: "Callback processed" });

  } catch (err) {
    console.log("Callback error:", err.message);
    return res.status(500).json({ message: "Callback error" });
  }
});

module.exports = router;