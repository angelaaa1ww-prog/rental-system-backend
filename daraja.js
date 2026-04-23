const axios = require('axios');
require('dotenv').config();

// =====================
// DARAJA CONFIG
// =====================
const consumerKey = process.env.CONSUMER_KEY;
const consumerSecret = process.env.CONSUMER_SECRET;
const shortcode = process.env.BUSINESS_SHORTCODE;
const passkey = process.env.PASSKEY;

// =====================
// GET ACCESS TOKEN
// =====================
const getAccessToken = async () => {
  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');

  const response = await axios.get(
    'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
    {
      headers: {
        Authorization: `Basic ${auth}`,
      },
    }
  );

  return response.data.access_token;
};

// =====================
// STK PUSH
// =====================
const stkPush = async (phone, amount) => {
  const token = await getAccessToken();

  const timestamp = new Date()
    .toISOString()
    .replace(/[-T:\.Z]/g, '')
    .slice(0, 14);

  const password = Buffer.from(
    shortcode + passkey + timestamp
  ).toString('base64');

  const response = await axios.post(
    'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
    {
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: amount,
      PartyA: phone,
      PartyB: shortcode,
      PhoneNumber: phone,
      CallBackURL: 'https://yourdomain.com/api/mpesa/callback',
      AccountReference: 'RENT',
      TransactionDesc: 'Rent Payment',
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );

  return response.data;
};

module.exports = { stkPush };