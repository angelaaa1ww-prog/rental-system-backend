const express = require("express");

const router = express.Router();

const {
    validatePayment,
    confirmPayment
} = require("../controllers/mpesaController");



router.post("/validate", validatePayment);

router.post("/confirm", confirmPayment);


module.exports = router;