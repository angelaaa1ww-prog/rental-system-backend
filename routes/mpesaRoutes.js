const express = require('express');
const axios = require('axios');
const router = express.Router();
const auth = require('../middleware/authMiddleware');

// Safaricom Daraja Sandbox Test Credentials
// In production, these should be in your .env file
const CONSUMER_KEY = process.env.MPESA_CONSUMER_KEY || 'N2qXpQW0QYAAXGXY1W81r2H1E4hG9zXn73sZq1q2pI1Yv1n4';
const CONSUMER_SECRET = process.env.MPESA_CONSUMER_SECRET || 'pA1eQ3ZpI2X3ZpXn73sZq1q2pI1Yv1n4';
const SHORTCODE = process.env.MPESA_SHORTCODE || '174379';
const PASSKEY = process.env.MPESA_PASSKEY || 'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919';

// Middleware to generate Daraja OAuth Token
const generateToken = async (req, res, next) => {
  const authString = Buffer.from(`${CONSUMER_KEY}:${CONSUMER_SECRET}`).toString('base64');
  try {
    const response = await axios.get('https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials', {
      headers: { Authorization: `Basic ${authString}` }
    });
    req.mpesaToken = response.data.access_token;
    next();
  } catch (error) {
    console.error('MPESA Token Generation Failed:', error?.response?.data || error.message);
    res.status(500).json({ message: 'Failed to authenticate with MPESA', error: error?.response?.data });
  }
};

// =====================
// INITIATE STK PUSH
// =====================
router.post('/stkpush', auth, generateToken, async (req, res) => {
  const { phone, amount, tenantId } = req.body;

  if (!phone || !amount || !tenantId) {
    return res.status(400).json({ message: 'Phone, amount, and tenantId are required' });
  }

  // Format phone number to 2547XXXXXXXX
  let formattedPhone = phone.replace(/\s+/g, '');
  if (formattedPhone.startsWith('0')) {
    formattedPhone = '254' + formattedPhone.substring(1);
  } else if (formattedPhone.startsWith('+')) {
    formattedPhone = formattedPhone.substring(1);
  }

  const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, -3);
  const password = Buffer.from(`${SHORTCODE}${PASSKEY}${timestamp}`).toString('base64');

  // YOUR NGROK URL GOES HERE!
  // Safaricom needs a public URL to send the payment confirmation back to your local server.
  const callbackUrl = process.env.MPESA_CALLBACK_URL || 'https://your-ngrok-url.ngrok.io/api/mpesa/callback';

  const stkPayload = {
    BusinessShortCode: SHORTCODE,
    Password: password,
    Timestamp: timestamp,
    TransactionType: 'CustomerPayBillOnline',
    Amount: Math.ceil(amount), // Must be a whole number
    PartyA: formattedPhone, // The user paying
    PartyB: SHORTCODE, // The business receiving
    PhoneNumber: formattedPhone,
    CallBackURL: `${callbackUrl}?tenantId=${tenantId}`, // Attach tenant ID so we know who paid
    AccountReference: 'Gifted Hands',
    TransactionDesc: 'Rent Payment'
  };

  try {
    const response = await axios.post(
      'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
      stkPayload,
      { headers: { Authorization: `Bearer ${req.mpesaToken}` } }
    );
    
    // Response indicates STK push sent successfully
    res.json({ message: 'STK Push sent successfully', data: response.data });
  } catch (error) {
    console.error('STK Push Error:', error?.response?.data || error.message);
    res.status(500).json({ message: 'Failed to send STK Push', error: error?.response?.data });
  }
});

module.exports = router;
