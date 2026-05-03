require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

const app = express();

/* =========================
   CORS (FIXED)
========================= */
const ALLOWED_ORIGINS = [
  /^http:\/\/localhost(:\d+)?$/,                              // any localhost port
  /^https:\/\/giftedhandsventures\.vercel\.app$/,            // custom domain
  /^https:\/\/rental-system-frontend[^.]*\.vercel\.app$/,    // ALL Vercel preview URLs
  /^https:\/\/[^.]*angelaaa1ww-progs-projects\.vercel\.app$/, // team preview URLs
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser requests (curl, Postman, server-to-server)
    if (!origin) return callback(null, true);
    const allowed = ALLOWED_ORIGINS.some(pattern => pattern.test(origin));
    if (allowed) return callback(null, true);
    console.warn(`🚫 CORS blocked: ${origin}`);
    callback(new Error(`CORS: origin ${origin} not allowed`));
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