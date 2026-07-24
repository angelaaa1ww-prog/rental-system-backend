require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

const c2bRoutes = require("./routes/c2bRoutes");

const app = express();

/* =========================
   DATABASE
========================= */
connectDB();

/* =========================
   CORS
========================= */
const ALLOWED_ORIGINS = [
  /^http:\/\/localhost(:\d+)?$/,
  /^https:\/\/giftedhandsventures\.vercel\.app$/,
  /^https:\/\/rental-system-frontend[^.]*\.vercel\.app$/,
  /^https:\/\/[^.]*angelaaa1ww-progs-projects\.vercel\.app$/,
  /^https:\/\/(www\.)?giftedhandsventure\.com$/,
  /^https:\/\/(www\.)?giftedhandsventures\.com$/
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);

    const allowed = ALLOWED_ORIGINS.some(pattern => pattern.test(origin));
    if (allowed) return callback(null, true);

    console.warn(` CORS blocked: ${origin}`);
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true
}));

/* =========================
   SECURITY MIDDLEWARE
========================= */
// 1. Security Headers (Clickjacking, MIME Sniffing, XSS protection)
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  res.setHeader("X-Download-Options", "noopen");
  res.setHeader("X-Permitted-Cross-Domain-Policies", "none");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});

// 2. NoSQL Injection Prevention Middleware
const sanitizeObject = (obj) => {
  if (!obj || typeof obj !== "object") return obj;
  for (const key of Object.keys(obj)) {
    if (key.startsWith("$") || key.includes(".")) {
      delete obj[key];
    } else if (typeof obj[key] === "object") {
      sanitizeObject(obj[key]);
    }
  }
  return obj;
};

app.use((req, res, next) => {
  if (req.body) sanitizeObject(req.body);
  if (req.query) sanitizeObject(req.query);
  if (req.params) sanitizeObject(req.params);
  next();
});

// 3. In-Memory Rate Limiter against Brute-Force Password & Auth Attacks
const ipAttemptsMap = new Map();
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS_PER_WINDOW = 20;

const authRateLimiter = (req, res, next) => {
  const ip = req.ip || req.headers["x-forwarded-for"] || "unknown-ip";
  const now = Date.now();
  const record = ipAttemptsMap.get(ip) || { count: 0, firstAttempt: now };

  if (now - record.firstAttempt > RATE_LIMIT_WINDOW_MS) {
    record.count = 1;
    record.firstAttempt = now;
  } else {
    record.count += 1;
  }

  ipAttemptsMap.set(ip, record);

  if (record.count > MAX_ATTEMPTS_PER_WINDOW) {
    console.warn(`🚨 Rate limit exceeded for IP: ${ip}`);
    return res.status(429).json({
      message: "Too many login attempts. Please try again after 15 minutes."
    });
  }

  next();
};

app.use("/api/auth", authRateLimiter);
app.use("/api/google-auth", authRateLimiter);

app.use(express.json());

/* =========================
   ROUTES (CLEAN MOUNTING)
========================= */
app.use("/api/c2b", c2bRoutes);

const loadRoute = (path, route) => {
  try {
    app.use(path, require(route));
    console.log(`✅ Loaded: ${path}`);
  } catch (err) {
    console.error(`❌ Failed to load ${path}:`, err.message);
  }
};

loadRoute('/api/auth', './routes/authRoutes');
loadRoute('/api/tenants', './routes/tenantRoutes');
loadRoute('/api/houses', './routes/houseRoutes');
loadRoute('/api/payments', './routes/paymentRoutes');
loadRoute('/api/dashboard', './routes/dashboardRoutes');
loadRoute('/api/reminders', './routes/reminderRoutes');
loadRoute('/api/mpesa', './routes/mpesaRoutes');
loadRoute('/api/sms', './routes/smsRoutes');
loadRoute('/api/reports', './routes/reportRoutes');
loadRoute('/api/rent', './routes/rentRoutes');
loadRoute('/api/overdue', './routes/overdueRoutes');

loadRoute('/api/tenant-auth', './routes/tenantAuthRoutes');

loadRoute('/api/maintenance', './routes/maintenanceRoutes');

loadRoute('/api/expenses', './routes/expenseRoutes');

loadRoute('/api/2fa', './routes/twoFactorRoutes');
loadRoute('/api/google-auth', './routes/googleAuth');

/* =========================
   CRON JOB
========================= */
require('./cron/rentCron');

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
  console.log(`Server running on port ${PORT}`);
  console.log(` Admin: ${process.env.ADMIN_EMAIL || 'giftedhandsventures.co.ke'}`);
});
