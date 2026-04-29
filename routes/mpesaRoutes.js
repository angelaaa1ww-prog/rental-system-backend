const express  = require("express");
const router   = express.Router();
const { stkPush } = require("../utils/mpesa");

const Tenant  = require("../models/Tenant");
const Payment = require("../models/Payment");
const auth    = require("../middleware/authMiddleware");
const sendSMS = require("../utils/sms");


// =============================================
// ROUTE 1 — TRIGGER STK PUSH
// POST /api/mpesa/pay
// Body: { tenantId, amount? }
// amount is optional — falls back to house rent
// =============================================
router.post("/pay", auth, async (req, res) => {
  try {
    const { tenantId, amount } = req.body;

    if (!tenantId) {
      return res.status(400).json({ message: "tenantId is required" });
    }

    // Populate house so we can read rent amount
    const tenant = await Tenant.findById(tenantId).populate("house");

    if (!tenant) {
      return res.status(404).json({ message: "Tenant not found" });
    }

    if (!tenant.phone) {
      return res.status(400).json({ message: "Tenant has no phone number" });
    }

    if (!tenant.house) {
      return res.status(400).json({
        message: "Tenant has no house assigned. Please assign a house first."
      });
    }

    // ✅ Use custom amount if provided, otherwise fall back to house rent
    const amountToPay = amount ? Number(amount) : Number(tenant.house.rent);

    if (!amountToPay || amountToPay < 1) {
      return res.status(400).json({
        message: "Invalid amount. Please enter a valid amount or set rent on the house."
      });
    }

    const month = new Date().toISOString().slice(0, 7); // e.g. "2025-04"

    // Check if tenant already paid this month (only block if full house rent amount)
    if (tenant.lastPaidMonth === month && !amount) {
      return res.status(400).json({
        message: "Rent already paid for this month"
      });
    }

    // Check if there is already a pending STK push this month
    const existingPending = await Payment.findOne({
      tenant: tenantId,
      status: "pending",
      month
    });

    if (existingPending) {
      return res.status(400).json({
        message: "There is already a pending M-Pesa payment. Please wait for it to complete or check Payments page."
      });
    }

    // Trigger STK push — sends M-Pesa prompt to tenant's phone
    const result = await stkPush({
      phone:       tenant.phone,
      amount:      amountToPay,
      accountRef:  tenant.house.houseNumber || "Rent",
      description: `Rent - ${tenant.name}`,
    });

    if (result.ResponseCode !== "0") {
      return res.status(400).json({
        message: "STK push failed. Check your Daraja credentials.",
        details: result,
      });
    }

    // Save a pending payment — confirmed when callback fires
    await Payment.create({
      tenant:        tenantId,
      amount:        amountToPay,
      reference:     result.CheckoutRequestID,
      status:        "pending",
      month,
      paymentMethod: "mpesa",
    });

    res.json({
      message:           "M-Pesa prompt sent to tenant's phone successfully",
      checkoutRequestId: result.CheckoutRequestID,
      customerMessage:   result.CustomerMessage,
      amount:            amountToPay,
      tenant:            tenant.name,
    });

  } catch (err) {
    console.error("STK PUSH ERROR:", err?.response?.data || err.message);
    res.status(500).json({
      message: "M-Pesa request failed",
      error:   err?.response?.data || err.message,
    });
  }
});


// =============================================
// ROUTE 2 — M-PESA CALLBACK
// POST /api/mpesa/callback
// ⚠️ No auth middleware — Safaricom calls this directly
// =============================================
router.post("/callback", async (req, res) => {
  try {
    console.log("📲 M-PESA CALLBACK:", JSON.stringify(req.body, null, 2));

    const stkCallback = req.body?.Body?.stkCallback;

    if (!stkCallback) {
      return res.json({ ResultCode: 0, ResultDesc: "Accepted" });
    }

    const resultCode   = stkCallback.ResultCode;
    const checkoutId   = stkCallback.CheckoutRequestID;
    const callbackMeta = stkCallback.CallbackMetadata?.Item || [];

    const getMeta = (name) =>
      callbackMeta.find((i) => i.Name === name)?.Value || null;

    const mpesaCode = getMeta("MpesaReceiptNumber");
    const amount    = getMeta("Amount");
    const phone     = getMeta("PhoneNumber");

    const payment = await Payment.findOne({ reference: checkoutId });

    if (!payment) {
      return res.json({ ResultCode: 0, ResultDesc: "Accepted" });
    }

    if (resultCode === 0) {
      // ✅ Payment successful — update record
      await Payment.findOneAndUpdate(
        { reference: checkoutId },
        {
          status:       "confirmed",
          mpesaReceipt: mpesaCode,
          reference:    mpesaCode,
          amount:       Number(amount) || payment.amount,
        }
      );

      // Mark tenant as paid this month
      await Tenant.findByIdAndUpdate(payment.tenant, {
        lastPaidMonth: payment.month
      });

      // Send SMS confirmation to tenant
      try {
        const tenant = await Tenant.findById(payment.tenant);
        if (tenant?.phone) {
          await sendSMS(
            tenant.phone,
            `Dear ${tenant.name}, we have received your payment of KES ${Number(amount).toLocaleString()}. M-Pesa Receipt: ${mpesaCode}. Thank you! - Rental Manager`
          );
        }
      } catch (smsErr) {
        console.error("SMS after payment failed:", smsErr.message);
      }

      console.log(`✅ Payment confirmed: ${mpesaCode} | KES ${amount}`);

    } else {
      // ❌ Payment failed or cancelled
      await Payment.findOneAndUpdate(
        { reference: checkoutId },
        { status: "failed" }
      );
      console.log(`❌ Payment failed. ResultCode: ${resultCode}`);
    }

    // Always return 200 to Safaricom
    res.json({ ResultCode: 0, ResultDesc: "Accepted" });

  } catch (err) {
    console.error("CALLBACK ERROR:", err.message);
    res.json({ ResultCode: 0, ResultDesc: "Accepted" });
  }
});


// =============================================
// ROUTE 3 — CHECK PAYMENT STATUS
// GET /api/mpesa/status/:checkoutId
// Frontend polls this after STK push
// =============================================
router.get("/status/:checkoutId", auth, async (req, res) => {
  try {
    const payment = await Payment.findOne({
      reference: req.params.checkoutId,
    }).populate("tenant", "name phone");

    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }

    res.json({
      status:    payment.status,
      amount:    payment.amount,
      tenant:    payment.tenant?.name,
      reference: payment.reference,
      month:     payment.month,
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


module.exports = router;
