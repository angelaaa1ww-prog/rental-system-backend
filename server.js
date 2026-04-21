require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

const app = express();

app.use(cors());
app.use(express.json());

connectDB();

// routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/tenants', require('./routes/tenantRoutes'));
app.use('/api/houses', require('./routes/houseRoutes'));
app.use('/api/payments', require('./routes/paymentRoutes'));
app.use('/api/rent', require('./routes/rentRoutes'));
app.use('/api/dashboard', require('./routes/dashboardRoutes'));

app.get('/', (req, res) => {
  res.json({ status: "Rental System API Running" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));