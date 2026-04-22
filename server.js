require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

const app = express();

// =====================
// CORE MIDDLEWARE
// =====================
app.use(cors());
app.use(express.json());

// =====================
// DB CONNECTION
// =====================
connectDB();

// =====================
// CRON JOB (AUTO REMINDERS)
// =====================
require("./cron/rentCron");

// =====================
// ROUTE LOADER
// =====================
const loadRoute = (path, route) => {
  try {
    app.use(path, require(route));
    console.log(`Loaded: ${path}`);
  } catch (err) {
    console.log(`Skipped ${path} (missing or broken)`);
  }
};

// =====================
// CORE ROUTES
// =====================
loadRoute('/api/auth', './routes/authRoutes');
loadRoute('/api/tenants', './routes/tenantRoutes');
loadRoute('/api/houses', './routes/houseRoutes');
loadRoute('/api/payments', './routes/paymentRoutes');
loadRoute('/api/dashboard', './routes/dashboardRoutes');
loadRoute('/api/reminders', './routes/reminderRoutes');
loadRoute('/api/mpesa', './routes/mpesaCallbackRoutes');
loadRoute('/api/sms', './routes/smsRoutes');
loadRoute('/api/reports', './routes/reportRoutes');
loadRoute('/api/sms', './routes/smsRoutes');

// =====================
// OPTIONAL ROUTES
// =====================
loadRoute('/api/rent', './routes/rentRoutes');

// =====================
// SMS SETUP
// =====================
const sendSMS = require('./utils/sms');

// =====================
// TEST SMS ROUTE
// =====================
app.get('/test-sms', async (req, res) => {
  try {
    const result = await sendSMS(
      "+254741642131", // ⚠️ replace with YOUR real number
      "Test SMS from Rental System - Africa's Talking activation check"
    );

    res.json({
      message: "SMS request sent",
      result
    });

  } catch (err) {
    res.status(500).json({
      message: "SMS failed",
      error: err.message
    });
  }
});

// =====================
// HEALTH CHECK
// =====================
app.get('/', (req, res) => {
  res.json({
    status: "Rental System API Running",
    version: "2.0 Clean Stable Build",
    time: new Date().toISOString()
  });
});

// =====================
// ERROR HANDLER
// =====================
app.use((err, req, res, next) => {
  console.error("Server Error:", err.message);
  res.status(500).json({ message: "Internal server error" });
});

// =====================
// START SERVER
// =====================
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});