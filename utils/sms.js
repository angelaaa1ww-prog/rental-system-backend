const AfricasTalking = require("africastalking");

const africasTalking = AfricasTalking({
  apiKey: process.env.AT_API_KEY,
  username: process.env.AT_USERNAME // sandbox or live
});

const sms = africasTalking.SMS;

/**
 * FORMAT PHONE NUMBER SAFELY
 */
const formatPhone = (phone) => {
  if (!phone) return phone;

  // convert 07XXXXXXXX → +2547XXXXXXXX
  if (phone.startsWith("0")) {
    return "+254" + phone.substring(1);
  }

  // already correct
  if (phone.startsWith("+")) return phone;

  return "+254" + phone;
};

/**
 * SEND SMS FUNCTION
 */
const sendSMS = async (phone, message) => {
  try {
    const formattedPhone = formatPhone(phone);

    console.log("SMS SENDING TO:", formattedPhone);

    const result = await sms.send({
      to: [formattedPhone],
      message,
      from: process.env.AT_SENDER_ID || "AFRICASTKNG"
    });

    console.log("SMS RESULT:", result);

    return result;

  } catch (err) {
    console.error("SMS ERROR FULL:", err);
    throw new Error(
      err?.message || "SMS sending failed"
    );
  }
};

module.exports = sendSMS;