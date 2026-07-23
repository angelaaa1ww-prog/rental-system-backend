const express = require("express");
const crypto = require("crypto");
const auth = require("../middleware/authMiddleware");
const {
  validatePayment,
  confirmPayment,
  registerC2BUrls,
  simulateC2BPayment,
} = require("../controller/mpesaController");

const router = express.Router();

// Middleware: C2B Hash Verification System
const verifyC2BHash = (req, res, next) => {
  const c2bSecret = process.env.MPESA_C2B_SECRET || process.env.MPESA_HASH_SECRET || "GHV_C2B_Secret_2026_Gifted";
  if (!c2bSecret) {
    // If no secret configured, allow Safaricom Daraja callbacks normally
    return next();
  }

  const incomingToken =
    req.headers["x-mpesa-token"] ||
    req.headers["x-signature"] ||
    req.query.secret ||
    req.headers["authorization"];

  const payloadString = JSON.stringify(req.body || {});
  const computedHash = crypto
    .createHmac("sha256", c2bSecret)
    .update(payloadString)
    .digest("hex");

  if (
    incomingToken === c2bSecret ||
    incomingToken === computedHash ||
    incomingToken === `Bearer ${c2bSecret}`
  ) {
    return next();
  }

  console.warn("⚠️ C2B security hash token mismatch — callback rejected.");
  return res.status(403).json({
    ResultCode: 1,
    ResultDesc: "Invalid C2B security hash token",
  });
};

// Public Daraja callback webhooks with Hash System security
router.post("/validation", verifyC2BHash, validatePayment);
router.post("/validate", verifyC2BHash, validatePayment);
router.post("/confirmation", verifyC2BHash, confirmPayment);
router.post("/confirm", verifyC2BHash, confirmPayment);

// Daraja C2B registration & simulation endpoints (accessible for one-click browser trigger)
router.get("/register", registerC2BUrls);
router.post("/register", registerC2BUrls);
router.get("/simulate", simulateC2BPayment);
router.post("/simulate", simulateC2BPayment);

// Public/Admin C2B config info
router.get("/config", async (req, res) => {
  try {
    const shortCode = process.env.MPESA_SHORTCODE || "400222";
    const accountPrefix = process.env.MPESA_ACCOUNT_PREFIX || "1183070#";
    // These values are hardcoded so no extra Render env vars are needed
    const c2bSecretConfigured = Boolean(process.env.MPESA_C2B_SECRET || process.env.MPESA_HASH_SECRET);

    return res.json({
      payBillNumber: shortCode,
      accountPrefix,
      accountReferenceFormat: `${accountPrefix}<HouseNumber> (e.g. ${accountPrefix}A101) or ${accountPrefix}<HouseID>`,
      instructions: `Use PayBill Business Number ${shortCode} and Account ${accountPrefix}<HouseNumber> (e.g., ${accountPrefix}A101)`,
      hashSecurityEnabled: c2bSecretConfigured,
      environment: process.env.MPESA_ENV || "sandbox"
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to get C2B configuration", error: error.message });
  }
});

module.exports = router;
