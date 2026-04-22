const express = require("express");
const router = express.Router();

const Payment = require("../models/Payment");

// =====================
// M-PESA CALLBACK
// =====================
// Safaricom will POST here after STK push
router.post("/callback", async (req, res) => {
  try {
    const body = req.body;

    const stkCallback = body?.Body?.stkCallback;

    if (!stkCallback) {
      return res.status(400).json({ message: "Invalid callback" });
    }

    const resultCode = stkCallback.ResultCode;
    const metadata = stkCallback.CallbackMetadata;

    const checkoutRequestID = stkCallback.CheckoutRequestID;

    // =====================
    // FAILED PAYMENT
    // =====================
    if (resultCode !== 0) {
      await Payment.findOneAndUpdate(
        { reference: checkoutRequestID },
        { status: "failed" }
      );

      return res.json({ message: "Payment failed recorded" });
    }

    // =====================
    // SUCCESS PAYMENT
    // =====================
    const items = metadata.Item;

    const amount = items.find(i => i.Name === "Amount")?.Value;
    const receipt = items.find(i => i.Name === "MpesaReceiptNumber")?.Value;

    await Payment.findOneAndUpdate(
      { reference: checkoutRequestID },
      {
        status: "confirmed",
        mpesaReceipt: receipt,
        amount
      }
    );

    return res.json({ message: "Payment confirmed" });

  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: "Callback error" });
  }
});

module.exports = router;