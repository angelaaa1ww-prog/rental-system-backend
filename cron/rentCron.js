const cron = require('node-cron');
const Tenant = require('../models/Tenant');
const Payment = require('../models/Payment');
const sendSMS = require('../utils/sms');
const { DUE_DAY, REMINDER_BEFORE_DAYS } = require('../config/rentConfig');

// Runs every day at 8AM
cron.schedule("0 8 * * *", async () => {
  try {
    console.log("📢 Running rent reminder system...");

    const today = new Date();
    const day = today.getDate();

    const tenants = await Tenant.find().populate('house');

    for (let tenant of tenants) {
      if (!tenant.house || !tenant.phone) continue;

      const rent = tenant.house.rent;

      const payments = await Payment.find({ tenant: tenant._id });
      const paid = payments.reduce((sum, p) => sum + p.amount, 0);

      const balance = rent - paid;

      // =====================
      // 1. 10 DAYS BEFORE DUE DATE
      // =====================
      if (day === (DUE_DAY - REMINDER_BEFORE_DAYS)) {
        if (balance > 0) {
          await sendSMS(
            tenant.phone,
            `REMINDER: Rent of KES ${balance} is due in ${REMINDER_BEFORE_DAYS} days. Please prepare payment.`
          );
        }
      }

      // =====================
      // 2. DUE DATE
      // =====================
      if (day === DUE_DAY) {
        if (balance > 0) {
          await sendSMS(
            tenant.phone,
            `TODAY IS RENT DUE DAY: You owe KES ${balance}. Please pay immediately.`
          );
        }
      }

      // =====================
      // 3. AFTER DUE DATE
      // =====================
      if (day > DUE_DAY) {
        if (balance > 0) {
          await sendSMS(
            tenant.phone,
            `LATE PAYMENT NOTICE: You are overdue by KES ${balance}. Please clear your rent immediately.`
          );
        }
      }
    }

    console.log("📢 Rent reminders processed");

  } catch (err) {
    console.log("Cron error:", err.message);
  }
});