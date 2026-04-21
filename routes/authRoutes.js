const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const SECRET = "mysecretkey";

// fake user (temporary)
const user = {
  email: "admin@test.com",
  password: bcrypt.hashSync("1234", 10)
};

router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (email !== user.email) {
    return res.status(400).json({ message: "User not found" });
  }

  const isMatch = await bcrypt.compare(password, user.password);

  if (!isMatch) {
    return res.status(400).json({ message: "Invalid credentials" });
  }

  const token = jwt.sign(
    { email: user.email, role: "admin" },
    SECRET,
    { expiresIn: "1d" }
  );

  res.json({
    token,
    role: "admin"
  });
});

module.exports = router;