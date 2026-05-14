const express = require("express");
const auth = require("../middleware/authMiddleware");

const router = express.Router();

const {
    validatePayment,
    confirmPayment,
    initiateStkPush,
    handleStkCallback,
    checkStkStatus
} = require("../controller/mpesaController");


router.post("/validate", validatePayment);
router.post("/confirm", confirmPayment);
router.post("/stk-callback", handleStkCallback);
router.post("/pay", auth, initiateStkPush);
router.post("/stkpush", auth, initiateStkPush);
router.get("/status/:checkoutRequestID", auth, checkStkStatus);

module.exports = router;
