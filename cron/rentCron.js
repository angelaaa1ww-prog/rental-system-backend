const cron = require('node-cron');

const Tenant = require('../models/Tenant');
const Payment = require('../models/Payment');
const sendSMS = require('../utils/sms');


// =====================
// SMART RENT SYSTEM
// =====================
cron.schedule("0 8 * * *", async () => {
  try {
    console.log("🔔 Running SMART rent system...");

    const tenants = await Tenant.find().populate('house');

    const today = new Date();

    for (let tenant of tenants) {
      if (!tenant.house || !tenant.phone) continue;

      const rent = tenant.house.rent;

      const payments = await Payment.find({
        tenant: tenant._id,
        status: "confirmed"
      });

      const paid = payments.reduce((sum, p) => sum + p.amount, 0);
      const balance = rent - paid;

      const dueDate = tenant.dueDate;

      // =========================
      // CASE 1: NO DUE DATE
      // =========================
      if (!dueDate) continue;

      const diffTime = dueDate - today;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      // =========================
      // 10 DAYS BEFORE DUE
      // =========================
      if (diffDays === 10) {
        await sendSMS(
          tenant.phone,
          `Hi ${tenant.name}, rent of KES ${rent} is due in 10 days. Please prepare payment.`
        );
      }

      // =========================
      // DUE TODAY
      // =========================
      if (diffDays === 0) {
        await sendSMS(
          tenant.phone,
          `Hi ${tenant.name}, your rent of KES ${rent} is due TODAY. Please pay to avoid penalties.`
        );
      }

      // =========================
      // OVERDUE
      // =========================
      if (diffDays < 0 && balance > 0) {
        await sendSMS(
          tenant.phone,
          `OVERDUE NOTICE: Hi ${tenant.name}, your rent balance is KES ${balance}. Please clear immediately to avoid eviction action.`
        );
      }

    }

  } catch (err) {
    console.log("SMART CRON ERROR:", err.message);
  }
});