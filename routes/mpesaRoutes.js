const express = require("express");

const router = express.Router();

const {
    validatePayment,
    confirmPayment,
    initiateStkPush,
    checkStkStatus
} = require("../controller/mpesaController");


router.post("/validate", validatePayment);
router.post("/confirm", confirmPayment);
router.post("/pay", initiateStkPush);
router.get("/status/:checkoutRequestID", checkStkStatus);

module.exports = router;