const axios = require("axios");

const {
  MPESA_CONSUMER_KEY,
  MPESA_CONSUMER_SECRET,
  MPESA_SHORTCODE,
  MPESA_PASSKEY,
  MPESA_CALLBACK_URL,
  MPESA_ENV,
} = process.env;

const BASE_URL =
  MPESA_ENV === "production"
    ? "https://api.safaricom.co.ke"
    : "https://sandbox.safaricom.co.ke";


// =============================================
// GET ACCESS TOKEN (FIXED ERROR HANDLING)
// =============================================
const getAccessToken = async () => {
  try {
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

  } catch (err) {
    console.error("❌ TOKEN ERROR:", err.response?.data || err.message);
    throw new Error("Failed to generate M-Pesa token");
  }
};


// =============================================
// TIMESTAMP + PASSWORD
// =============================================
const getTimestampAndPassword = () => {
  const now = new Date();

  const pad = (n) => String(n).padStart(2, "0");

  const timestamp =
    `${now.getFullYear()}` +
    `${pad(now.getMonth() + 1)}` +
    `${pad(now.getDate())}` +
    `${pad(now.getHours())}` +
    `${pad(now.getMinutes())}` +
    `${pad(now.getSeconds())}`;

  const password = Buffer.from(
    `${MPESA_SHORTCODE}${MPESA_PASSKEY}${timestamp}`
  ).toString("base64");

  return { timestamp, password };
};


// =============================================
// STK PUSH (FIXED CORE ISSUES)
// =============================================
const stkPush = async ({ phone, amount, accountRef, description }) => {
  const token = await getAccessToken();
  const { timestamp, password } = getTimestampAndPassword();

  if (!token) throw new Error("Missing access token");

  // FIXED phone normalization (VERY IMPORTANT)
  let formattedPhone = String(phone).trim();

  if (formattedPhone.startsWith("0")) {
    formattedPhone = "254" + formattedPhone.slice(1);
  }

  if (formattedPhone.startsWith("+")) {
    formattedPhone = formattedPhone.replace("+", "");
  }

  // FORCE integer amount
  const safeAmount = parseInt(amount, 10);

  const payload = {
    BusinessShortCode: MPESA_SHORTCODE,
    Password: password,
    Timestamp: timestamp,
    TransactionType: "CustomerPayBillOnline",
    Amount: safeAmount,
    PartyA: formattedPhone,
    PartyB: MPESA_SHORTCODE,
    PhoneNumber: formattedPhone,
    CallBackURL: MPESA_CALLBACK_URL,
    AccountReference: accountRef || "Rent",
    TransactionDesc: description || "Rent Payment",
  };

  try {
    const res = await axios.post(
      `${BASE_URL}/mpesa/stkpush/v1/processrequest`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("📡 STK RESPONSE:", res.data);

    return res.data;

  } catch (err) {
    console.error("❌ STK ERROR:", err.response?.data || err.message);
    throw err;
  }
};

module.exports = { stkPush, getAccessToken };