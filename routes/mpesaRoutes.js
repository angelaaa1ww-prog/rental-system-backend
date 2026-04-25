const express  = require("express");
const router   = express.Router();
const { stkPush } = require("../utils/mpesa");

const Tenant  = require("../models/Tenant");
const Payment = require("../models/Payment");
const auth    = require("../middleware/authMiddleware");


// =============================================
// ROUTE 1 — TRIGGER STK PUSH
// POST /api/mpesa/pay
// Body: { tenantId, amount }
// =============================================
router.post("/pay", auth, async (req, res) => {
  try {
    const { tenantId, amount } = req.body;

    if (!tenantId || !amount) {
      return res.status(400).json({ message: "tenantId and amount required" });
    }

    const tenant = await Tenant.findById(tenantId).populate("house");

    if (!tenant) {
      return res.status(404).json({ message: "Tenant not found" });
    }

    if (!tenant.phone) {
      return res.status(400).json({ message: "Tenant has no phone number" });
    }

    const result = await stkPush({
      phone: tenant.phone,
      amount: Number(amount),
      accountRef: tenant.house?.houseNumber || "Rent",
      description: `Rent - ${tenant.name}`,
    });

    if (result.ResponseCode !== "0") {
      return res.status(400).json({
        message: "STK push failed",
        details: result,
      });
    }

    await Payment.create({
      tenant: tenantId,
      amount: Number(amount),
      reference: result.CheckoutRequestID,
      status: "pending",
    });

    res.json({
      message: "M-Pesa prompt sent to tenant's phone",
      checkoutRequestId: result.CheckoutRequestID,
      customerMessage: result.CustomerMessage,
    });

  } catch (err) {
    console.error("STK PUSH ERROR:", err?.response?.data || err.message);
    res.status(500).json({
      message: "M-Pesa request failed",
      error: err?.response?.data || err.message,
    });
  }
});


// =============================================
// ROUTE 2 — M-PESA CALLBACK
// =============================================
router.post("/callback", async (req, res) => {
  try {
    console.log("📲 M-PESA CALLBACK RECEIVED:", JSON.stringify(req.body, null, 2));

    const stkCallback = req.body?.Body?.stkCallback;

    if (!stkCallback) {
      return res.json({ ResultCode: 0, ResultDesc: "Accepted" });
    }

    const resultCode = stkCallback.ResultCode;
    const checkoutId = stkCallback.CheckoutRequestID;
    const callbackMeta = stkCallback.CallbackMetadata?.Item || [];

    const getMeta = (name) =>
      callbackMeta.find((i) => i.Name === name)?.Value || null;

    const mpesaCode = getMeta("MpesaReceiptNumber");
    const amount = getMeta("Amount");
    const phone = getMeta("PhoneNumber");

    if (resultCode === 0) {
      await Payment.findOneAndUpdate(
        { reference: checkoutId },
        {
          status: "confirmed",
          mpesaReceipt: mpesaCode,
          amount: amount,
          phone: phone,
        }
      );

      console.log(`✅ Payment confirmed: ${mpesaCode} | KES ${amount} | ${phone}`);

    } else {
      await Payment.findOneAndUpdate(
        { reference: checkoutId },
        { status: "failed" }
      );

      console.log(`❌ Payment failed. Code: ${resultCode}`);
    }

    res.json({ ResultCode: 0, ResultDesc: "Accepted" });

  } catch (err) {
    console.error("CALLBACK ERROR:", err.message);
    res.json({ ResultCode: 0, ResultDesc: "Accepted" });
  }
});


// =============================================
// ROUTE 3 — CHECK PAYMENT STATUS
// =============================================
router.get("/status/:checkoutId", auth, async (req, res) => {
  try {
    const payment = await Payment.findOne({
      reference: req.params.checkoutId,
    }).populate("tenant");

    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }

    res.json({
      status: payment.status,
      amount: payment.amount,
      tenant: payment.tenant?.name,
      reference: payment.reference,
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;