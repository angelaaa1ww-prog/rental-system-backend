const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const SECRET = process.env.JWT_SECRET || "mysecretkey";


// TEMP USER (for development only)
const user = {
  email: "admin@test.com",
  password: bcrypt.hashSync("1234", 10),
  role: "admin"
};


// =====================
// LOGIN
// =====================
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // basic validation
    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password required"
      });
    }

    // check user
    if (email !== user.email) {
      return res.status(400).json({
        message: "User not found"
      });
    }

    // verify password
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({
        message: "Invalid credentials"
      });
    }

    // generate token
    const token = jwt.sign(
      {
        email: user.email,
        role: user.role
      },
      SECRET,
      { expiresIn: "1d" }
    );

    return res.json({
      token,
      role: user.role
    });

  } catch (err) {
    return res.status(500).json({
      message: "Login error",
      error: err.message
    });
  }
});

module.exports = router;