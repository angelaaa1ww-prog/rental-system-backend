const express = require("express");

const router = express.Router();

const {
    validatePayment,
    confirmPayment
} = require("../controller/mpesaController");



router.post("/validate", validatePayment);

router.post("/confirm", confirmPayment);


module.exports = router;