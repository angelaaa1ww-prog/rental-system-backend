const jwt = require('jsonwebtoken');
const SECRET = process.env.JWT_SECRET || "mysecretkey";

module.exports = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ message: "No token" });

  try {
    const token = header.split(" ")[1];
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    res.status(401).json({ message: "Invalid token" });
  }
};