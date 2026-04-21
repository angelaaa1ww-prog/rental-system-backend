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
// SAFE ROUTE LOADING
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
// ROUTES
// =====================
loadRoute('/api/auth', './routes/authRoutes');
loadRoute('/api/tenants', './routes/tenantRoutes');
loadRoute('/api/houses', './routes/houseRoutes');
loadRoute('/api/payments', './routes/paymentRoutes');
loadRoute('/api/dashboard', './routes/dashboardRoutes');

// OPTIONAL (ONLY IF EXISTS)
loadRoute('/api/rent', './routes/rentRoutes');

// =====================
// HEALTH CHECK
// =====================
app.get('/', (req, res) => {
  res.json({
    status: "Rental System API Running",
    time: new Date().toISOString()
  });
});

// =====================
// ERROR HANDLER (IMPORTANT)
// =====================
app.use((err, req, res, next) => {
  console.error("Server Error:", err.message);
  res.status(500).json({ message: "Internal server error" });
});

// =====================
// START SERVER
// =====================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});