const Payment = require('../models/Payment');
const Tenant = require('../models/Tenant');
const sendSMS = require('./sms');

/**
 * Check tenants and send rent reminders
 */
const checkRentReminders = async () => {
  try {
    const tenants = await Tenant.find().populate('house');

    const results = [];

    for (let tenant of tenants) {
      if (!tenant.house) continue;

      const rent = tenant.house.rent;

      const payments = await Payment.find({ tenant: tenant._id });
      const paid = payments.reduce((sum, p) => sum + p.amount, 0);

      const balance = rent - paid;

      // 👉 ONLY SEND IF THERE IS BALANCE
      if (balance > 0 && tenant.phone) {
        const message =
`REMINDER:
Hi ${tenant.name}, your rent balance is KES ${balance}.
Please clear before end of month.`;

        await sendSMS(tenant.phone, message);

        results.push({
          tenant: tenant.name,
          balance
        });
      }
    }

    return results;

  } catch (err) {
    console.log("Reminder error:", err.message);
    return [];
  }
};

module.exports = { checkRentReminders };