const express = require("express");
const axios = require("axios");
const router = express.Router();

/* =========================
   ACCESS TOKEN (INLINE)
========================= */
const generateToken = async () => {
    try {
        const auth = Buffer.from(
            process.env.CONSUMER_KEY +
            ":" +
            process.env.CONSUMER_SECRET
        ).toString("base64");

        const response = await axios.get(
            "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
            {
                headers: {
                    Authorization: `Basic ${auth}`
                },
                timeout: 15000
            }
        );

        return response.data.access_token;

    } catch (error) {
        console.log("🔥 TOKEN ERROR:");
        console.log(error.response?.data || error.message);
        throw new Error("Failed to generate token");
    }
};

/* =========================
   REGISTER URLS
========================= */
router.get("/register", async (req, res) => {

    try {
        console.log("📡 C2B register triggered");

        const token = await generateToken();

        const ngrokUrl = process.env.NGROK_URL;

        if (!ngrokUrl) {
            return res.status(400).json({
                error: "NGROK_URL missing in .env"
            });
        }

        const payload = {
            ShortCode: "600000",
            ResponseType: "Completed",
            ConfirmationURL: `${ngrokUrl}/api/c2b/confirmation`,
            ValidationURL: `${ngrokUrl}/api/c2b/validation`
        };

        console.log("📦 Payload:", payload);

        const response = await axios.post(
            "https://sandbox.safaricom.co.ke/mpesa/c2b/v1/registerurl",
            payload,
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json"
                },
                timeout: 15000
            }
        );

        console.log("✅ REGISTER SUCCESS:", response.data);

        res.json(response.data);

    } catch (error) {

        console.log("🔥 REGISTER ERROR:");
        console.log(error.response?.data || error.message || error);

        res.status(500).json({
            error: error.response?.data || error.message || "Unknown error"
        });
    }
});

/* =========================
   VALIDATION URL
========================= */
router.post("/validation", (req, res) => {

    console.log("🔍 VALIDATION RECEIVED:");
    console.log(req.body);

    return res.json({
        ResultCode: 0,
        ResultDesc: "Accepted"
    });
});

/* =========================
   CONFIRMATION URL
========================= */
router.post("/confirmation", (req, res) => {

    console.log("💰 CONFIRMATION RECEIVED:");
    console.log(JSON.stringify(req.body, null, 2));

    return res.json({
        ResultCode: 0,
        ResultDesc: "Received successfully"
    });
});

module.exports = router;