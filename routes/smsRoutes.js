const express = require('express');
const router = express.Router();
const SmsLog = require('../models/SmsLog');
const auth = require('../middleware/authMiddleware');

// GET ALL SMS LOGS
router.get('/', auth, async (req, res) => {
  try {
    const logs = await SmsLog.find()
      .populate('tenant')
      .sort({ createdAt: -1 });

    res.json(logs);

  } catch (err) {
    res.status(500).json({
      message: "Failed to load SMS logs",
      error: err.message
    });
  }
});

module.exports = router;