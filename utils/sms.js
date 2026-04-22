const AfricasTalking = require('africastalking');

const africasTalking = AfricasTalking({
  apiKey: process.env.AT_API_KEY,
  username: process.env.AT_USERNAME
});

const sms = africasTalking.SMS;

/**
 * Send SMS function
 */
const sendSMS = async (phone, message) => {
  try {
    const result = await sms.send({
      to: phone,
      message
    });

    console.log("SMS sent:", result);
    return result;
  } catch (err) {
    console.log("SMS ERROR:", err.message);
    return null;
  }
};

module.exports = sendSMS;