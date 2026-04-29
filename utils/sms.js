const AfricasTalking = require("africastalking");

const at = AfricasTalking({
  username: process.env.AT_USERNAME,
  apiKey:   process.env.AT_API_KEY,
});

const sms = at.SMS;

// =============================================
// FORMAT PHONE NUMBER
// Converts any Kenyan format to +254XXXXXXXXX
// =============================================
const formatPhone = (phone) => {
  if (!phone) return null;

  let p = String(phone).trim().replace(/\s+/g, '');

  if (p.startsWith("0"))    return "+254" + p.substring(1);   // 07XX → +2547XX
  if (p.startsWith("254"))  return "+"    + p;                // 254XX → +254XX
  if (p.startsWith("+254")) return p;                         // already correct
  if (p.startsWith("7") || p.startsWith("1")) return "+254" + p; // 7XX → +2547XX

  return p;
};

// =============================================
// SEND SMS
// =============================================
const sendSMS = async (phone, message) => {
  try {
    const formattedPhone = formatPhone(phone);

    if (!formattedPhone) {
      throw new Error("Invalid phone number");
    }

    console.log(`📱 Sending SMS to ${formattedPhone}...`);

    const payload = {
      to:      [formattedPhone],
      message: message,
    };

    // Only add sender ID if set — sandbox sometimes rejects custom sender IDs
    if (process.env.AT_SENDER_ID) {
      payload.from = process.env.AT_SENDER_ID;
    }

    const result = await sms.send(payload);

    console.log("✅ SMS SENT:", JSON.stringify(result, null, 2));
    return result;

  } catch (err) {
    console.error("❌ SMS ERROR:", err.message);
    throw new Error(err.message || "SMS sending failed");
  }
};

// =============================================
// ✅ DEFAULT EXPORT — so all files can import as:
// const sendSMS = require('../utils/sms')
// =============================================
module.exports = sendSMS;