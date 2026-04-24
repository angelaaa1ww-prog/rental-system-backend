require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

const app = express();

/* =========================
   CORS (FIXED PROPERLY)
========================= */

const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173'
];

app.use(cors({
  origin: function (origin, callback) {
    // allow tools like Postman / server-to-server requests
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    console.log("❌ Blocked by CORS:", origin);
    return callback(new Error('Not allowed by CORS'));
  },
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
loadRoute('/api/rent/pay',  './routes/rentPaymentRoutes');

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
app.use('/api/rent', require('./routes/rentPaymentRoutes'));

/* =========================
   START SERVER
========================= */

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📌 Admin: ${process.env.ADMIN_EMAIL || 'admin@rentals.co.ke'}`);
});