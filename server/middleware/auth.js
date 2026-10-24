const jwt = require('jsonwebtoken');
const db = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'smarthub_dev_secret_key_2026_jwt_token';

// Required Authentication Middleware
function authRequired(req, res, next) {
  let token = req.headers['authorization'];
  if (token && token.startsWith('Bearer ')) {
    token = token.slice(7).trim();
  } else {
    token = req.headers['x-auth-token'] || req.query.token;
  }

  // Also support fallback header x-user-id for easy client-side simulation
  const fallbackUserId = req.headers['x-user-id'];

  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const user = db.findById('users', decoded.id);
      if (user) {
        req.user = user;
        return next();
      }
    } catch (err) {
      // Invalid JWT token
    }
  }

  if (fallbackUserId) {
    const user = db.findById('users', fallbackUserId);
    if (user) {
      req.user = user;
      return next();
    }
  }

  return res.status(401).json({ success: false, error: 'Unauthorized: Authentication required' });
}

// Optional Auth (attaches req.user if found, but doesn't block)
function authOptional(req, res, next) {
  let token = req.headers['authorization'];
  if (token && token.startsWith('Bearer ')) {
    token = token.slice(7).trim();
  } else {
    token = req.headers['x-auth-token'] || req.query.token;
  }

  const fallbackUserId = req.headers['x-user-id'];

  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const user = db.findById('users', decoded.id);
      if (user) {
        req.user = user;
        return next();
      }
    } catch (err) {}
  }

  if (fallbackUserId) {
    const user = db.findById('users', fallbackUserId);
    if (user) {
      req.user = user;
      return next();
    }
  }

  next();
}

module.exports = {
  authRequired,
  authOptional,
  JWT_SECRET
};
