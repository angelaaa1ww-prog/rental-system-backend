const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || "mysecretkey";

module.exports = (req, res, next) => {
  const header = req.headers.authorization;

  if (!header) {
    return res.status(401).json({
      code: "NO_AUTH_HEADER",
      message: "Missing authorization header"
    });
  }

  const parts = header.split(" ");

  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return res.status(401).json({
      code: "BAD_FORMAT",
      message: "Token must be: Bearer <token>"
    });
  }

  const token = parts[1];

  if (!token || token === "undefined" || token === "null") {
    return res.status(401).json({
      code: "EMPTY_TOKEN",
      message: "Token is invalid"
    });
  }

  try {
    const decoded = jwt.verify(token, SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({
      code: "INVALID_TOKEN",
      message: "Token expired or invalid"
    });
  }
};