const express = require("express");
const auth = require("../middleware/authMiddleware");
const {
  validatePayment,
  confirmPayment,
  registerC2BUrls,
  simulateC2BPayment,
} = require("../controller/mpesaController");

const router = express.Router();

// Public Daraja callbacks.
router.post("/validation", validatePayment);
router.post("/validate", validatePayment);
router.post("/confirmation", confirmPayment);
router.post("/confirm", confirmPayment);

// Admin-only Daraja setup/testing helpers.
router.post("/register", auth, registerC2BUrls);
router.get("/register", auth, registerC2BUrls);
router.post("/simulate", auth, simulateC2BPayment);

// Get C2B configuration (safe for public exposure)
router.get("/config", async (req, res) => {
  try {
    const shortCode = process.env.MPESA_SHORTCODE || "";
    if (!shortCode) {
      return res.status(500).json({ message: "MPESA_SHORTCODE not configured" });
    }

    return res.json({
      payBillNumber: shortCode,
      // Account reference format explanation
      accountReferenceFormat: "Tenant ID or House Number",
      instructions: "Use your PayBill number as the Business Number and your tenant ID or house number as the Account reference"
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to get C2B configuration", error: error.message });
  }
});

module.exports = router;
