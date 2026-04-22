const express = require('express');
const router = express.Router();

const Payment = require('../models/Payment');
const Tenant = require('../models/Tenant');
const sendSMS = require('../utils/sms');


// =====================
// M-PESA CALLBACK
// =====================
router.post('/stk', async (req, res) => {
  try {
    const body = req.body;

    console.log("M-PESA CALLBACK:", JSON.stringify(body, null, 2));

    const callback = body?.Body?.stkCallback;

    if (!callback) {
      return res.status(400).json({ message: "Invalid callback" });
    }

    const resultCode = callback.ResultCode;
    const metadata = callback.CallbackMetadata?.Item || [];

    const getValue = (name) =>
      metadata.find(item => item.Name === name)?.Value;

    const amount = getValue("Amount");
    const phone = getValue("PhoneNumber");
    const receipt = getValue("MpesaReceiptNumber");

    // =========================
    // PAYMENT SUCCESS
    // =========================
    if (resultCode === 0) {

      const payment = await Payment.findOneAndUpdate(
        { reference: receipt },
        { status: "confirmed", mpesaReceipt: receipt },
        { new: true }
      ).populate("tenant");

      if (payment?.tenant?.phone) {
        await sendSMS(
          payment.tenant.phone,
          `Payment received successfully. Receipt: ${receipt}. Amount: KES ${amount}`
        );
      }

      return res.json({ message: "Payment confirmed" });
    }

    // =========================
    // PAYMENT FAILED
    // =========================
    await Payment.updateMany(
      { reference: receipt },
      { status: "failed" }
    );

    return res.json({ message: "Payment failed" });

  } catch (err) {
    console.error("Callback error:", err.message);

    return res.status(500).json({
      message: "Callback processing failed",
      error: err.message
    });
  }
});

module.exports = router;