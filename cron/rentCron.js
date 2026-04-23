const cron    = require('node-cron');
const Tenant  = require('../models/Tenant');
const Payment = require('../models/Payment');
const sendSMS = require('../utils/sms');

// =====================
// SMART RENT REMINDER — runs every day at 8:00 AM
// =====================
cron.schedule('0 8 * * *', async () => {
  console.log('🔔 Running daily rent reminder cron...');

  try {
    const tenants = await Tenant.find({ active: true }).populate('house');

    // Batch all confirmed payments in ONE query
    const allPayments = await Payment.find({ status: 'confirmed' });
    const paymentMap  = {};
    allPayments.forEach(p => {
      const id = String(p.tenant);
      paymentMap[id] = (paymentMap[id] || 0) + (p.amount || 0);
    });

    const today = new Date();

    for (const tenant of tenants) {
      if (!tenant.house || !tenant.phone) continue;

      const rent    = tenant.house.rent || 0;
      const paid    = paymentMap[String(tenant._id)] || 0;
      const balance = rent - paid;
      const dueDate = tenant.dueDate;

      if (!dueDate) continue;

      const diffDays = Math.ceil((new Date(dueDate) - today) / (1000 * 60 * 60 * 24));

      // 10 days before due
      if (diffDays === 10) {
        await sendSMS(
          tenant.phone,
          `Hi ${tenant.name}, your rent of KES ${rent.toLocaleString()} is due in 10 days. Please prepare your payment. - Rental Manager`
        ).catch(e => console.error(`SMS failed for ${tenant.name}:`, e.message));
      }

      // Due today
      if (diffDays === 0 && balance > 0) {
        await sendSMS(
          tenant.phone,
          `Hi ${tenant.name}, your rent of KES ${rent.toLocaleString()} is due TODAY. Please pay to avoid penalties. - Rental Manager`
        ).catch(e => console.error(`SMS failed for ${tenant.name}:`, e.message));
      }

      // Overdue
      if (diffDays < 0 && balance > 0) {
        await sendSMS(
          tenant.phone,
          `OVERDUE: Hi ${tenant.name}, your rent balance is KES ${balance.toLocaleString()}. Please clear immediately to avoid further action. - Rental Manager`
        ).catch(e => console.error(`SMS failed for ${tenant.name}:`, e.message));
      }
    }

    console.log('✅ Rent reminder cron complete.');
  } catch (err) {
    console.error('❌ Rent cron error:', err.message);
  }
});