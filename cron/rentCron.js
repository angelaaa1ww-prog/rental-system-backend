const cron = require('node-cron');

const Tenant = require('../models/Tenant');
const RentRecord = require('../models/RentRecord');

// runs every 1st day of month at 00:05
cron.schedule('5 0 1 * *', async () => {
  try {
    console.log("🔄 Auto rent generation running...");

    const month = new Date().toLocaleString('default', {
      month: 'long',
      year: 'numeric'
    });

    const tenants = await Tenant.find().populate('house');

    let created = 0;

    for (let t of tenants) {
      if (!t.house) continue;

      const exists = await RentRecord.findOne({
        tenant: t._id,
        month
      });

      if (!exists) {
        await RentRecord.create({
          tenant: t._id,
          house: t.house._id,
          month,
          expectedAmount: t.house.rent,
          status: "unpaid"
        });

        created++;
      }
    }

    console.log(`✅ Auto rent done. Created: ${created}`);
  } catch (err) {
    console.log("❌ Auto rent error:", err.message);
  }
});