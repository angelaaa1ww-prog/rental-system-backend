const express = require('express');
const router = express.Router();
const axios = require('axios');

router.post('/pay-rent', async (req, res) => {
  try {
    const { phone, amount, account } = req.body;

    // 1. Get token
    const auth = Buffer.from(
      process.env.DARAJA_CONSUMER_KEY + ':' + process.env.DARAJA_CONSUMER_SECRET
    ).toString('base64');

    const tokenRes = await axios.get(
      'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
      {
        headers: {
          Authorization: `Basic ${auth}`
        }
      }
    );

    const token = tokenRes.data.access_token;

    // 2. Time
    const timestamp = new Date()
      .toISOString()
      .replace(/[-T:.Z]/g, '')
      .slice(0, 14);

    // 3. Password
    const password = Buffer.from(
      process.env.DARAJA_SHORTCODE +
      process.env.DARAJA_PASSKEY +
      timestamp
    ).toString('base64');

    // 4. STK Push
    const stkResponse = await axios.post(
      'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
      {
        BusinessShortCode: process.env.DARAJA_SHORTCODE,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: amount,
        PartyA: phone,
        PartyB: process.env.DARAJA_SHORTCODE,
        PhoneNumber: phone,
        CallBackURL: process.env.CALLBACK_URL,
        AccountReference: account,
        TransactionDesc: 'Rent Payment'
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    res.json(stkResponse.data);

  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: 'Rent payment failed' });
  }
});

module.exports = router;