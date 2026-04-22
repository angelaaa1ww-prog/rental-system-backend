const AfricasTalking = require("africastalking");

// INIT CORRECTLY
const at = AfricasTalking({
  apiKey: process.env.AT_API_KEY,
  username: process.env.AT_USERNAME
});

const payments = at.PAYMENTS;

/**
 * FORMAT KENYA NUMBER
 */
const formatPhone = (phone) => {
  if (!phone) return phone;

  if (phone.startsWith("0")) {
    return "+254" + phone.substring(1);
  }

  if (phone.startsWith("254")) {
    return "+" + phone;
  }

  if (phone.startsWith("+")) return phone;

  return "+254" + phone;
};

/**
 * STK PUSH (FIXED VERSION)
 */
const stkPush = async (phone, amount) => {
  const formattedPhone = formatPhone(phone);

  console.log("👉 STK PUSH REQUEST:", formattedPhone, amount);

  // SAFETY CHECK
  if (!payments) {
    throw new Error("Africa's Talking PAYMENTS not enabled for this account");
  }

  try {
    const result = await payments.mobileCheckout({
      productName: process.env.AT_PRODUCT_NAME || "RentalSystem",
      phoneNumber: formattedPhone,
      currencyCode: "KES",
      amount: Number(amount)
    });

    console.log("✅ STK RESPONSE:", result);

    return result;

  } catch (err) {
    console.log("❌ STK ERROR:", err);
    throw new Error(err.message);
  }
};

module.exports = { stkPush };