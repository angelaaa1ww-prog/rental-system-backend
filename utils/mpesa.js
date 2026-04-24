const axios = require("axios");

// =============================================
// DARAJA CONFIG (reads from your .env)
// =============================================
const {
  MPESA_CONSUMER_KEY,
  MPESA_CONSUMER_SECRET,
  MPESA_SHORTCODE,
  MPESA_PASSKEY,
  MPESA_CALLBACK_URL,
  MPESA_ENV,             // "sandbox" or "production"
} = process.env;

// Base URL switches between sandbox and live automatically
const BASE_URL =
  MPESA_ENV === "production"
    ? "https://api.safaricom.co.ke"
    : "https://sandbox.safaricom.co.ke";


// =============================================
// STEP 1 — GET OAUTH ACCESS TOKEN
// =============================================
const getAccessToken = async () => {
  const credentials = Buffer.from(
    `${MPESA_CONSUMER_KEY}:${MPESA_CONSUMER_SECRET}`
  ).toString("base64");

  const res = await axios.get(
    `${BASE_URL}/oauth/v1/generate?grant_type=client_credentials`,
    {
      headers: {
        Authorization: `Basic ${credentials}`,
      },
    }
  );

  return res.data.access_token;
};


// =============================================
// STEP 2 — GENERATE PASSWORD + TIMESTAMP
// =============================================
const getTimestampAndPassword = () => {
  const now    = new Date();
  const pad    = (n) => String(n).padStart(2, "0");

  const timestamp =
    `${now.getFullYear()}` +
    `${pad(now.getMonth() + 1)}` +
    `${pad(now.getDate())}` +
    `${pad(now.getHours())}` +
    `${pad(now.getMinutes())}` +
    `${pad(now.getSeconds())}`;

  // Password = Base64(Shortcode + Passkey + Timestamp)
  const password = Buffer.from(
    `${MPESA_SHORTCODE}${MPESA_PASSKEY}${timestamp}`
  ).toString("base64");

  return { timestamp, password };
};


// =============================================
// STEP 3 — STK PUSH (sends M-Pesa prompt to phone)
// =============================================
const stkPush = async ({ phone, amount, accountRef, description }) => {
  const token = await getAccessToken();
  const { timestamp, password } = getTimestampAndPassword();

  // Format phone: 0712345678 → 254712345678
  let formattedPhone = String(phone).trim();
  if (formattedPhone.startsWith("0")) {
    formattedPhone = "254" + formattedPhone.substring(1);
  } else if (formattedPhone.startsWith("+")) {
    formattedPhone = formattedPhone.substring(1);
  }

  const payload = {
    BusinessShortCode: MPESA_SHORTCODE,
    Password:          password,
    Timestamp:         timestamp,
    TransactionType:   "CustomerPayBillOnline",
    Amount:            Math.round(amount),       // must be integer
    PartyA:            formattedPhone,           // tenant phone
    PartyB:            MPESA_SHORTCODE,          // your shortcode
    PhoneNumber:       formattedPhone,           // same as PartyA
    CallBackURL:       MPESA_CALLBACK_URL,       // your callback endpoint
    AccountReference:  accountRef || "Rent",
    TransactionDesc:   description || "Rent Payment",
  };

  const res = await axios.post(
    `${BASE_URL}/mpesa/stkpush/v1/processrequest`,
    payload,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  return res.data;
};


// =============================================
// EXPORT
// =============================================
module.exports = { stkPush, getAccessToken };