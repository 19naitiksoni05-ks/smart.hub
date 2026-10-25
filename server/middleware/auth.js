const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const db = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'smarthub_dev_secret_key_2026_jwt_token';

function hashApiKey(rawKey) {
  return crypto.createHash('sha256').update(rawKey.trim()).digest('hex');
}

function resolveAuthContext(req) {
  // 1. Check custom X-API-Key header
  const apiKeyHeader = req.headers['x-api-key'];
  if (apiKeyHeader) {
    const keyHash = hashApiKey(apiKeyHeader);
    const keyRecord = db.findOne('apiKeys', k => k.keyHash === keyHash && k.status === 'active');
    if (keyRecord) {
      db.update('apiKeys', keyRecord.id, { lastUsedAt: new Date().toISOString() });
      const user = db.findById('users', keyRecord.userId);
      if (user) {
        return { user, apiKey: keyRecord, authType: 'api_key' };
      }
    }
  }

  // 2. Extract token from Authorization header or query parameter
  let token = req.headers['authorization'];
  if (token && token.startsWith('Bearer ')) {
    token = token.slice(7).trim();
  } else if (!token) {
    token = req.headers['x-auth-token'] || req.query.token || req.query.apiKey;
  }

  if (token) {
    // Check if token is a developer API key
    if (token.startsWith('sh_live_') || token.startsWith('sh_test_')) {
      const keyHash = hashApiKey(token);
      const keyRecord = db.findOne('apiKeys', k => k.keyHash === keyHash && k.status === 'active');
      if (keyRecord) {
        db.update('apiKeys', keyRecord.id, { lastUsedAt: new Date().toISOString() });
        const user = db.findById('users', keyRecord.userId);
        if (user) {
          return { user, apiKey: keyRecord, authType: 'api_key' };
        }
      }
      return null;
    }

    // Verify standard JWT token
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const user = db.findById('users', decoded.id);
      if (user) {
        return { user, authType: 'jwt' };
      }
    } catch (err) {
      // Invalid or expired JWT
    }
  }

  // 3. Fallback header for simulated sessions in development
  const fallbackUserId = req.headers['x-user-id'];
  if (fallbackUserId) {
    const user = db.findById('users', fallbackUserId);
    if (user) {
      return { user, authType: 'dev_header' };
    }
  }

  return null;
}

// Required Authentication Middleware
function authRequired(req, res, next) {
  const authContext = resolveAuthContext(req);
  if (authContext && authContext.user) {
    req.user = authContext.user;
    req.apiKey = authContext.apiKey || null;
    req.authType = authContext.authType;
    return next();
  }

  return res.status(401).json({
    success: false,
    error: 'Unauthorized: Valid JWT Bearer token or Smart Hub API Key (X-API-Key: sh_live_...) required'
  });
}

// Optional Auth (attaches req.user if found, but doesn't block)
function authOptional(req, res, next) {
  const authContext = resolveAuthContext(req);
  if (authContext && authContext.user) {
    req.user = authContext.user;
    req.apiKey = authContext.apiKey || null;
    req.authType = authContext.authType;
  }
  next();
}

// Admin Authentication Middleware
function adminRequired(req, res, next) {
  authRequired(req, res, () => {
    const isSuperAdmin = req.user && (
      req.user.role === 'admin' ||
      req.user.email?.toLowerCase() === 'naitik19ansh@gmail.com' ||
      req.user.username?.toLowerCase() === '@naitik19' ||
      req.user.name?.toLowerCase().includes('naitik')
    );

    if (isSuperAdmin) {
      if (req.user.role !== 'admin') req.user.role = 'admin';
      return next();
    }

    return res.status(403).json({
      success: false,
      error: 'Forbidden: Super Admin privileges required to inspect and modify platform data'
    });
  });
}

module.exports = {
  authRequired,
  authOptional,
  adminRequired,
  hashApiKey,
  JWT_SECRET
};
