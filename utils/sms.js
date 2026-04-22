const AfricasTalking = require('africastalking');
const SmsLog = require('../models/SmsLog');

const africastalking = AfricasTalking({
  username: process.env.AT_USERNAME,
  apiKey: process.env.AT_API_KEY
});

const sms = africastalking.SMS;

module.exports = async (phone, message, tenantId = null) => {
  try {
    const result = await sms.send({
      to: [phone],
      message
    });

    const data = result.SMSMessageData.Recipients[0];

    await SmsLog.create({
      phone,
      message,
      status: data.status === "Success" ? "sent" : "failed",
      cost: data.cost,
      messageId: data.messageId,
      tenant: tenantId
    });

    return result;

  } catch (err) {
    await SmsLog.create({
      phone,
      message,
      status: "failed",
      tenant: tenantId
    });

    throw err;
  }
};