const express = require('express');
const router = express.Router();
const { stkPush } = require('../daraja');

// TEST ROUTE
router.post('/pay', async (req, res) => {
  try {
    const { phone, amount } = req.body;

    const response = await stkPush(phone, amount);

    res.json(response);
  } catch (err) {
  console.log("FULL ERROR:", err.response?.data || err.message);
  return res.status(500).json({
    error: err.response?.data || err.message
  });
}
  });

module.exports = router;