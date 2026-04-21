const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = require('./config/db');
const House = require('./models/House');
const RentRecord = require('./models/RentRecord');
const Tenant = require('./models/Tenant');
const Payment = require('./models/Payment');

async function reset() {
  try {
    await connectDB();

    console.log("🔄 Resetting database...");

    await RentRecord.deleteMany({});
    await Payment.deleteMany({});

    await Tenant.updateMany({}, { $set: { house: null } });

    await House.updateMany({}, {
      $set: {
        status: "available",
        tenant: null
      }
    });

    console.log("✅ Reset complete");
    process.exit();
  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  }
}

reset();