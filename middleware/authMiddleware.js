const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'secret';

// =============================================
// AUTH MIDDLEWARE
// Protects all routes that need login
// Token expires after 1 hour (set in authRoutes)
// =============================================
const auth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    // No token at all
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        message: 'Access denied. Please login first.'
      });
    }

    const token = authHeader.split(' ')[1];

    if (!token || token === 'null' || token === 'undefined') {
      return res.status(401).json({
        message: 'Invalid token. Please login again.'
      });
    }

    // Verify token — throws error if expired or tampered
    const decoded = jwt.verify(token, JWT_SECRET);

    // Attach user info to request
    req.user = decoded;
    next();

  } catch (err) {
    // Token expired
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        message: 'Session expired. Please login again.',
        expired: true
      });
    }

    // Token tampered/invalid
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({
        message: 'Invalid session. Please login again.',
        invalid: true
      });
    }

    return res.status(401).json({
      message: 'Authentication failed. Please login again.'
    });
  }
};

module.exports = auth;