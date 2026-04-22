const sendSMS = require("./sms");

/**
 * Sends receipt after payment
 */
const sendPaymentReceipt = async (tenant, amount, balance) => {
  if (!tenant || !tenant.phone) return;

  const message =
`Hi ${tenant.name},
Payment received: KES ${amount}.
Outstanding balance: KES ${balance}.
Thank you for your payment.`;

  await sendSMS(tenant.phone, message);
};

module.exports = { sendPaymentReceipt };