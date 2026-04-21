const jwt = require('jsonwebtoken');

const SECRET = "mysecretkey";

module.exports = (req, res, next) => {
  try {
    const header = req.headers.authorization;

    // 1. check if token exists
    if (!header) {
      return res.status(401).json({ message: "No token provided" });
    }

    // 2. remove "Bearer " safely
    const token = header.replace("Bearer ", "").trim();

    // 3. verify token
    const decoded = jwt.verify(token, SECRET);

    req.user = decoded;

    next();

  } catch (err) {
    return res.status(401).json({ message: "Invalid token" });
  }
};