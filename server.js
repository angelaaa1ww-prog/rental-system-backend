require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

const app = express();

/* =========================
   CORS (FIXED)
========================= */
app.use(cors({
  origin: [
    "http://localhost:3000",
    "https://giftedhandsventures.vercel.app",  // ← add this
    "https://rental-system-frontend-drab.vercel.app",
    "https://rental-system-frontend-i4qn0yzpu-angelaaa1ww-progs-projects.vercel.app",
    "https://rental-system-frontend-on8e2vasg-angelaaa1ww-progs-projects.vercel.app",
  ],
  credentials: true
}));

/* =========================
   MIDDLEWARE
========================= */
app.use(express.json());

/* =========================
   DATABASE
========================= */
connectDB();

/* =========================
   CRON JOB
========================= */
require('./cron/rentCron');

/* =========================
   ROUTES LOADER
========================= */
const loadRoute = (path, route) => {
  try {
    app.use(path, require(route));
    console.log(`✅ Loaded: ${path}`);
  } catch (err) {
    console.error(`❌ Failed to load ${path}:`, err.message);
  }
};

loadRoute('/api/auth',      './routes/authRoutes');
loadRoute('/api/tenants',   './routes/tenantRoutes');
loadRoute('/api/houses',    './routes/houseRoutes');
loadRoute('/api/payments',  './routes/paymentRoutes');
loadRoute('/api/dashboard', './routes/dashboardRoutes');
loadRoute('/api/reminders', './routes/reminderRoutes');
loadRoute('/api/mpesa',     './routes/mpesaRoutes');
loadRoute('/api/sms',       './routes/smsRoutes');
loadRoute('/api/reports',   './routes/reportRoutes');
loadRoute('/api/rent',      './routes/rentRoutes');

/* =========================
   HEALTH CHECK
========================= */
app.get('/', (req, res) => {
  res.json({
    status: 'Rental System API Running',
    version: '3.0 Production',
    time: new Date().toISOString()
  });
});

/* =========================
   404 HANDLER
========================= */
app.use((req, res) => {
  res.status(404).json({
    message: `Route ${req.method} ${req.path} not found`
  });
});

/* =========================
   GLOBAL ERROR HANDLER
========================= */
app.use((err, req, res, next) => {
  console.error('🔥 Server Error:', err.message);
  res.status(500).json({
    message: err.message || 'Internal server error'
  });
});

/* =========================
   START SERVER
========================= */
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📌 Admin: ${process.env.ADMIN_EMAIL || 'admin@rentals.co.ke'}`);
});