const express = require('express');
const router = express.Router();

const Tenant = require('../models/Tenant');
const House = require('../models/House');
const Payment = require('../models/Payment');
const auth = require('../middleware/authMiddleware');


// =====================
// MAIN DASHBOARD (UPGRADED)
// =====================
router.get('/', auth, async (req, res) => {
  try {

    const tenants = await Tenant.find();
    const houses = await House.find();
    const payments = await Payment.find();

    // =====================
    // BASIC COUNTS
    // =====================
    const totalTenants = tenants.length;
    const totalHouses = houses.length;

    // =====================
    // REVENUE
    // =====================
    const totalRevenue = payments.reduce((sum, p) => sum + (p.amountPaid || p.amount || 0), 0);

    // =====================
    // APARTMENT BREAKDOWN (NEW CORE FEATURE)
    // =====================
    const apartments = ["A", "B", "C", "D", "E"];

    const apartmentStats = apartments.map(ap => {

      const apHouses = houses.filter(h => h.apartment === ap);
      const apTenants = tenants.filter(t =>
        apHouses.some(h => String(h.tenant) === String(t._id))
      );

      const apPayments = payments.filter(p =>
        apHouses.some(h => String(h._id) === String(p.house))
      );

      const revenue = apPayments.reduce((sum, p) => sum + (p.amountPaid || p.amount || 0), 0);

      const occupied = apHouses.filter(h => h.status === "occupied").length;
      const available = apHouses.filter(h => h.status === "available").length;

      return {
        apartment: ap,
        totalHouses: apHouses.length,
        occupied,
        available,
        totalTenants: apTenants.length,
        revenue
      };
    });

    // =====================
    // ARREARS (who is behind)
    // =====================
    const arrears = houses.map(h => {
      const tenantPayments = payments.filter(p =>
        String(p.house) === String(h._id)
      );

      const paid = tenantPayments.reduce((sum, p) => sum + (p.amountPaid || 0), 0);
      const expected = h.rent || 0;

      return {
        house: h.houseNumber,
        apartment: h.apartment,
        tenant: h.tenant,
        expected,
        paid,
        balance: expected - paid
      };
    }).filter(a => a.balance > 0);

    // =====================
    // RESPONSE
    // =====================
    return res.json({
      totalTenants,
      totalHouses,
      totalRevenue,
      apartments: apartmentStats,
      arrears
    });

  } catch (err) {
    return res.status(500).json({
      message: "Dashboard failed",
      error: err.message
    });
  }
});

module.exports = router;