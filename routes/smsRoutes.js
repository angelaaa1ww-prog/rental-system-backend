const express = require("express");
const router = express.Router();
const sendSMS = require("../utils/sms");
const auth = require("../middleware/authMiddleware");

// =========================
// SEND SINGLE SMS
// =========================
router.post("/send", auth, async (req, res) => {
  try {
    const { phone, message } = req.body;

    if (!phone || !message) {
      return res.status(400).json({ message: "Missing fields" });
    }

    const result = await sendSMS(phone, message);

    res.json({
      message: "SMS sent successfully",
      result
    });

  } catch (err) {
    res.status(500).json({
      message: "SMS failed",
      error: err.message
    });
  }
});

// =========================
// BROADCAST (ALL TENANTS)
// =========================
const Tenant = require("../models/Tenant");

router.post("/broadcast", auth, async (req, res) => {
  try {
    const { message } = req.body;

    const tenants = await Tenant.find();

    const results = await Promise.all(
      tenants.map(t => {
        if (!t.phone) return null;
        return sendSMS(t.phone, message);
      })
    );

    res.json({
      message: "Broadcast complete",
      sent: results.filter(Boolean).length
    });

  } catch (err) {
    res.status(500).json({
      message: "Broadcast failed",
      error: err.message
    });
  }
});

module.exports = router;