const express = require("express");

const router = express.Router();

router.post("/confirmation", (req, res) => {

    console.log("PAYMENT RECEIVED");

    console.log(req.body);

    res.json({
        ResultCode: 0,
        ResultDesc: "Accepted"
    });
});

router.post("/validation", (req, res) => {

    console.log("VALIDATION");

    console.log(req.body);

    res.json({
        ResultCode: 0,
        ResultDesc: "Accepted"
    });
});

const axios = require("axios");

router.get("/register", async (req, res) => {

    try {

        const auth = Buffer.from(
            process.env.CONSUMER_KEY +
            ":" +
            process.env.CONSUMER_SECRET
        ).toString("base64");

        const tokenResponse =
        await axios.get(
            "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
            {
                headers: {
                    Authorization:
                    `Basic ${auth}`
                }
            }
        );

        const token =
        tokenResponse.data.access_token;

        const response =
        await axios.post(
            "https://sandbox.safaricom.co.ke/mpesa/c2b/v1/registerurl",
            {
                ShortCode: "600000",

                ResponseType:
                "Completed",

                ConfirmationURL:
"https://untrained-vaguely-unsettled.ngrok-free.dev -> http://localhost:5000",

                ValidationURL:
"https://untrained-vaguely-unsettled.ngrok-free.dev -> http://localhost:5000"
            },
            {
                headers: {
                    Authorization:
                    `Bearer ${token}`
                }
            }
        );

        res.json(response.data);

    } catch (error) {

        console.log(
            error.response?.data || error
        );

        res.status(500).json({
            error:
            error.response?.data || error.message
        });
    }
});
module.exports = router;