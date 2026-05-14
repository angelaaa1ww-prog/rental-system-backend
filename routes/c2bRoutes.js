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

module.exports = router;
