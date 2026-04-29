const cron    = require('node-cron');
const Tenant  = require('../models/Tenant');
const Payment = require('../models/Payment');
const sendSMS = require('../utils/sms');

// =============================================
// HELPER — check if tenant has paid THIS month
// =============================================
const hasPaidThisMonth = (payments, tenantId) => {
  const now        = new Date();
  const thisMonth  = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  return payments.some(p => {
    const isTenant    = String(p.tenant) === String(tenantId);
    const isConfirmed = p.status === 'confirmed';

    // Check by month field (M-Pesa payments)
    if (p.month) return isTenant && isConfirmed && p.month === thisMonth;

    // Fallback: check by createdAt date (manual cash payments)
    const payMonth = p.createdAt
      ? `${p.createdAt.getFullYear()}-${String(p.createdAt.getMonth() + 1).padStart(2, '0')}`
      : null;

    return isTenant && isConfirmed && payMonth === thisMonth;
  });
};


// =============================================
// CRON 1 — 1ST OF EVERY MONTH AT 8:00 AM
// Sends rent due reminder to ALL tenants
// =============================================
cron.schedule('0 8 1 * *', async () => {
  console.log('📅 Running 1st-of-month rent reminder...');

  try {
    const tenants     = await Tenant.find().populate('house');
    const allPayments = await Payment.find({ status: 'confirmed' });

    let sent   = 0;
    let skipped = 0;

    for (const tenant of tenants) {
      if (!tenant.house || !tenant.phone) { skipped++; continue; }

      const rent = tenant.house.rent || 0;
      if (!rent) { skipped++; continue; }

      // Skip if already paid this month
      if (hasPaidThisMonth(allPayments, tenant._id)) { skipped++; continue; }

      const month = new Date().toLocaleString('en-KE', { month: 'long', year: 'numeric' });

      await sendSMS(
        tenant.phone,
        `Dear ${tenant.name}, your rent of KES ${rent.toLocaleString()} for ${month} is now due. Please pay promptly to avoid penalties. Thank you. - Rental Manager`
      ).catch(e => console.error(`❌ SMS failed for ${tenant.name}:`, e.message));

      sent++;
      console.log(`📱 Reminder sent → ${tenant.name} (${tenant.phone})`);
    }

    console.log(`✅ 1st-of-month cron done. Sent: ${sent} | Skipped: ${skipped}`);

  } catch (err) {
    console.error('❌ 1st-of-month cron error:', err.message);
  }
});


// =============================================
// CRON 2 — EVERY DAY AT 8:00 AM
// Sends reminders for:
//   • 10 days before due date
//   • Due today
//   • Overdue (past due date, not yet paid)
// =============================================
cron.schedule('0 8 * * *', async () => {
  console.log('🔔 Running daily rent reminder cron...');

  try {
    const tenants     = await Tenant.find().populate('house');
    const allPayments = await Payment.find({ status: 'confirmed' });

    const today = new Date();
    today.setHours(0, 0, 0, 0); // normalize to midnight

    let sent = 0;

    for (const tenant of tenants) {
      if (!tenant.house || !tenant.phone) continue;

      const rent    = tenant.house.rent || 0;
      if (!rent) continue;

      // Skip if already paid this month
      if (hasPaidThisMonth(allPayments, tenant._id)) continue;

      // If tenant has a specific dueDate, use it
      // Otherwise default to the 5th of current month
      let dueDate;
      if (tenant.dueDate) {
        dueDate = new Date(tenant.dueDate);
      } else {
        dueDate = new Date(today.getFullYear(), today.getMonth(), 5);
      }
      dueDate.setHours(0, 0, 0, 0);

      const diffDays = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));

      // ── 10 days before due ──
      if (diffDays === 10) {
        await sendSMS(
          tenant.phone,
          `Hi ${tenant.name}, your rent of KES ${rent.toLocaleString()} is due in 10 days (${dueDate.toLocaleDateString('en-KE')}). Please prepare your payment. - Rental Manager`
        ).catch(e => console.error(`❌ SMS failed for ${tenant.name}:`, e.message));
        console.log(`📱 10-day reminder → ${tenant.name}`);
        sent++;
      }

      // ── 3 days before due ──
      if (diffDays === 3) {
        await sendSMS(
          tenant.phone,
          `Hi ${tenant.name}, reminder: your rent of KES ${rent.toLocaleString()} is due in 3 days. Please ensure payment is made on time. - Rental Manager`
        ).catch(e => console.error(`❌ SMS failed for ${tenant.name}:`, e.message));
        console.log(`📱 3-day reminder → ${tenant.name}`);
        sent++;
      }

      // ── Due today ──
      if (diffDays === 0) {
        await sendSMS(
          tenant.phone,
          `Hi ${tenant.name}, your rent of KES ${rent.toLocaleString()} is due TODAY. Please pay immediately to avoid late penalties. - Rental Manager`
        ).catch(e => console.error(`❌ SMS failed for ${tenant.name}:`, e.message));
        console.log(`📱 Due today reminder → ${tenant.name}`);
        sent++;
      }

      // ── Overdue (1 to 7 days past due) ──
      if (diffDays < 0 && diffDays >= -7) {
        const daysLate = Math.abs(diffDays);
        await sendSMS(
          tenant.phone,
          `OVERDUE: Hi ${tenant.name}, your rent of KES ${rent.toLocaleString()} is ${daysLate} day${daysLate > 1 ? 's' : ''} overdue. Please pay immediately to avoid further action. - Rental Manager`
        ).catch(e => console.error(`❌ SMS failed for ${tenant.name}:`, e.message));
        console.log(`📱 Overdue reminder → ${tenant.name} (${daysLate} days late)`);
        sent++;
      }

      // ── Seriously overdue (8+ days past due) ──
      if (diffDays < -7) {
        const daysLate = Math.abs(diffDays);
        await sendSMS(
          tenant.phone,
          `URGENT: Hi ${tenant.name}, your rent is ${daysLate} days overdue. Failure to pay may result in eviction proceedings. Please contact management immediately. - Rental Manager`
        ).catch(e => console.error(`❌ SMS failed for ${tenant.name}:`, e.message));
        console.log(`📱 Urgent overdue → ${tenant.name} (${daysLate} days late)`);
        sent++;
      }
    }

    console.log(`✅ Daily cron done. ${sent} SMS sent.`);

  } catch (err) {
    console.error('❌ Daily cron error:', err.message);
  }
});


// =============================================
// CRON 3 — TEST MODE (uncomment to test now)
// Runs every minute — use temporarily to verify
// SMS is working, then comment it back out
// =============================================
// cron.schedule('* * * * *', async () => {
//   console.log('🧪 TEST CRON running...');
//   const tenants = await Tenant.find().populate('house').limit(1);
//   if (tenants[0]?.phone) {
//     await sendSMS(
//       tenants[0].phone,
//       `TEST: Hi ${tenants[0].name}, this is a test reminder from Rental Manager.`
//     );
//     console.log('🧪 Test SMS sent to', tenants[0].name);
//   }
// });

console.log('✅ Rent reminder crons registered:');
console.log('   📅 1st of month at 8:00 AM → all unpaid tenants');
console.log('   🔔 Daily at 8:00 AM → 10-day, 3-day, due today, overdue alerts');