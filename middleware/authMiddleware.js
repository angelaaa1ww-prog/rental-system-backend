const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || "mysecretkey";

module.exports = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      code: "NO_AUTH_HEADER",
      message: "Missing authorization header"
    });
  }

  // accept case variations + trim spaces
  const [type, token] = authHeader.trim().split(" ");

  if (type !== "Bearer" || !token) {
    return res.status(401).json({
      code: "BAD_FORMAT",
      message: "Token must be: Bearer <token>"
    });
  }

  try {
    const decoded = jwt.verify(token, SECRET);
    req.user = decoded;
    return next();
  } catch (err) {
    return res.status(401).json({
      code: "INVALID_TOKEN",
      message: "Token expired or invalid"
    });
  }
};