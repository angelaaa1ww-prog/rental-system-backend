const AfricasTalking = require('africastalking');

const at = AfricasTalking({
  apiKey: process.env.AT_API_KEY,
  username: process.env.AT_USERNAME // sandbox or live
});

const mobile = at.SMS; // fallback for SMS if needed
const payments = at.PAYMENTS;

/**
 * STK PUSH (Mobile Payment Request)
 */
const stkPush = async (phone, amount) => {
  try {
    const result = await payments.mobileCheckout({
      productName: "RentalSystem",
      phoneNumber: phone,
      currencyCode: "KES",
      amount: amount
    });

    return result;

  } catch (err) {
    console.log("STK ERROR:", err.message);
    return null;
  }
};

module.exports = { stkPush };