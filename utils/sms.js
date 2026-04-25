const AfricasTalking = require("africastalking");

const at = AfricasTalking({
  username: process.env.AT_USERNAME,
  apiKey: process.env.AT_API_KEY,
});

const sms = at.SMS;

const sendSMS = async (phone, message) => {
  try {
    const result = await sms.send({
      to: [phone],
      message: message,
      from: process.env.AT_SENDER_ID,
    });

    console.log("📩 SMS SENT:", result);
  } catch (err) {
    console.error("SMS ERROR:", err.message);
  }
};

module.exports = { sendSMS };