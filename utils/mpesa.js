const axios = require("axios");

const REQUEST_TIMEOUT = 15000;

const readEnv = (...names) => {
  for (const name of names) {
    const value = process.env[name];
    if (value !== undefined && String(value).trim() !== "") {
      return String(value).trim();
    }
  }
  return "";
};

const requiredEnv = (label, ...names) => {
  const value = readEnv(...names);
  if (!value) {
    throw new Error(`${label} is required. Set one of: ${names.join(", ")}`);
  }
  return value;
};

const getBaseUrl = () => {
  const env = readEnv("MPESA_ENV", "DARAJA_ENV").toLowerCase();
  return env === "production" || env === "live"
    ? "https://api.safaricom.co.ke"
    : "https://sandbox.safaricom.co.ke";
};

const getCredentials = () => ({
  consumerKey: requiredEnv("M-Pesa consumer key", "MPESA_CONSUMER_KEY", "CONSUMER_KEY"),
  consumerSecret: requiredEnv("M-Pesa consumer secret", "MPESA_CONSUMER_SECRET", "CONSUMER_SECRET"),
  shortCode: requiredEnv("M-Pesa shortcode/paybill", "MPESA_SHORTCODE", "BUSINESS_SHORTCODE"),
  passkey: readEnv("MPESA_PASSKEY", "PASSKEY"),
});

const getCallbackBaseUrl = () => {
  const baseUrl = readEnv("MPESA_CALLBACK_BASE_URL", "BACKEND_URL", "NGROK_URL");
  return baseUrl.replace(/\/+$/, "");
};

const buildCallbackUrl = (path, explicitEnvName) => {
  const explicit = readEnv(explicitEnvName);
  if (explicit) return explicit;

  const baseUrl = getCallbackBaseUrl();
  if (!baseUrl) {
    throw new Error(
      `${explicitEnvName} or MPESA_CALLBACK_BASE_URL/BACKEND_URL is required for M-Pesa callbacks`
    );
  }

  return `${baseUrl}${path}`;
};

const normalizePhone = (phone) => {
  let value = String(phone || "").trim().replace(/[^\d+]/g, "");

  if (value.startsWith("+")) value = value.slice(1);
  if (value.startsWith("0")) value = `254${value.slice(1)}`;
  if (value.length === 9 && /^[17]/.test(value)) value = `254${value}`;

  if (!/^254\d{9}$/.test(value)) {
    throw new Error(`Invalid Kenyan M-Pesa phone number: ${phone}`);
  }

  return value;
};

const normalizeAmount = (amount) => {
  const value = Number(amount);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`Invalid M-Pesa amount: ${amount}`);
  }
  return value;
};

const getAccessToken = async () => {
  const { consumerKey, consumerSecret } = getCredentials();
  const credentials = Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64");

  try {
    const response = await axios.get(
      `${getBaseUrl()}/oauth/v1/generate?grant_type=client_credentials`,
      {
        headers: { Authorization: `Basic ${credentials}` },
        timeout: REQUEST_TIMEOUT,
      }
    );

    return response.data.access_token;
  } catch (err) {
    console.error("M-Pesa token error:", err.response?.data || err.message);
    throw new Error("Failed to generate M-Pesa access token");
  }
};

const getTimestampAndPassword = () => {
  const { shortCode, passkey } = getCredentials();
  if (!passkey) {
    throw new Error("M-Pesa passkey is required. Set MPESA_PASSKEY or PASSKEY.");
  }

  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const timestamp =
    `${now.getFullYear()}` +
    `${pad(now.getMonth() + 1)}` +
    `${pad(now.getDate())}` +
    `${pad(now.getHours())}` +
    `${pad(now.getMinutes())}` +
    `${pad(now.getSeconds())}`;

  const password = Buffer.from(`${shortCode}${passkey}${timestamp}`).toString("base64");
  return { timestamp, password };
};

const stkPush = async ({ phone, amount, accountRef, description }) => {
  const { shortCode } = getCredentials();
  const token = await getAccessToken();
  const { timestamp, password } = getTimestampAndPassword();
  const callbackUrl = buildCallbackUrl("/api/mpesa/stk-callback", "MPESA_STK_CALLBACK_URL");
  const formattedPhone = normalizePhone(phone);

  const payload = {
    BusinessShortCode: shortCode,
    Password: password,
    Timestamp: timestamp,
    TransactionType: "CustomerPayBillOnline",
    Amount: normalizeAmount(amount),
    PartyA: formattedPhone,
    PartyB: shortCode,
    PhoneNumber: formattedPhone,
    CallBackURL: callbackUrl,
    AccountReference: String(accountRef || "RENT").slice(0, 12),
    TransactionDesc: String(description || "Rent Payment").slice(0, 13),
  };

  try {
    const response = await axios.post(
      `${getBaseUrl()}/mpesa/stkpush/v1/processrequest`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        timeout: REQUEST_TIMEOUT,
      }
    );

    return response.data;
  } catch (err) {
    console.error("M-Pesa STK error:", err.response?.data || err.message);
    throw err;
  }
};

const getC2BCallbackUrls = () => ({
  confirmationUrl: buildCallbackUrl("/api/c2b/confirmation", "MPESA_C2B_CONFIRMATION_URL"),
  validationUrl: buildCallbackUrl("/api/c2b/validation", "MPESA_C2B_VALIDATION_URL"),
});

const registerC2BUrls = async () => {
  const { shortCode } = getCredentials();
  const token = await getAccessToken();
  const { confirmationUrl, validationUrl } = getC2BCallbackUrls();

  const payload = {
    ShortCode: shortCode,
    ResponseType: readEnv("MPESA_C2B_RESPONSE_TYPE") || "Completed",
    ConfirmationURL: confirmationUrl,
    ValidationURL: validationUrl,
  };

  try {
    const response = await axios.post(
      `${getBaseUrl()}/mpesa/c2b/v1/registerurl`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        timeout: REQUEST_TIMEOUT,
      }
    );

    return { request: payload, response: response.data };
  } catch (err) {
    console.error("M-Pesa C2B register error:", err.response?.data || err.message);
    throw err;
  }
};

const simulateC2BPayment = async ({ amount, phone, billRefNumber, commandId }) => {
  const { shortCode } = getCredentials();
  const token = await getAccessToken();

  const payload = {
    ShortCode: shortCode,
    CommandID: commandId || "CustomerPayBillOnline",
    Amount: normalizeAmount(amount),
    Msisdn: normalizePhone(phone),
    BillRefNumber: String(billRefNumber || "RENT").trim(),
  };

  try {
    const response = await axios.post(
      `${getBaseUrl()}/mpesa/c2b/v1/simulate`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        timeout: REQUEST_TIMEOUT,
      }
    );

    return { request: payload, response: response.data };
  } catch (err) {
    console.error("M-Pesa C2B simulate error:", err.response?.data || err.message);
    throw err;
  }
};

module.exports = {
  getAccessToken,
  getBaseUrl,
  getC2BCallbackUrls,
  normalizeAmount,
  normalizePhone,
  registerC2BUrls,
  simulateC2BPayment,
  stkPush,
};
