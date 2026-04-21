const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || "mysecretkey";

module.exports = (req, res, next) => {
  try {
    const header = req.headers.authorization;

    // 1. HARD CHECK
    if (!header) {
      return res.status(401).json({
        message: "Authorization header missing"
      });
    }

    // 2. FORMAT CHECK (Bearer token)
    const parts = header.split(" ");

    if (parts.length !== 2 || parts[0] !== "Bearer") {
      return res.status(401).json({
        message: "Invalid token format"
      });
    }

    const token = parts[1];

    if (!token || token === "undefined" || token === "null") {
      return res.status(401).json({
        message: "Token missing"
      });
    }

    // 3. VERIFY TOKEN
    const decoded = jwt.verify(token, SECRET);

    req.user = decoded;
    next();

  } catch (err) {
    return res.status(401).json({
      message: "Invalid or expired token",
      error: err.message
    });
  }
};