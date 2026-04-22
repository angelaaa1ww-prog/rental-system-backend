const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.json([
    { name: "A" },
    { name: "B" },
    { name: "C" }
  ]);
});

module.exports = router;