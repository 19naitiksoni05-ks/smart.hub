const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const db = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'smarthub_dev_secret_key_2026_jwt_token';

function hashApiKey(rawKey) {
  return crypto.createHash('sha256').update(rawKey.trim()).digest('hex');
}

function parseCookies(req) {
  const list = {};
  const cookieHeader = req.headers && req.headers.cookie;
  if (cookieHeader) {
    cookieHeader.split(';').forEach(c => {
      const parts = c.split('=');
      const name = parts.shift().trim();
      if (name) {
        list[name] = decodeURIComponent(parts.join('='));
      }
    });
  }
  return list;
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

  // 2. Extract token from Authorization header, Cookie, or query parameter
  let token = req.headers['authorization'];
  if (token && token.startsWith('Bearer ')) {
    token = token.slice(7).trim();
  } else {
    const cookies = parseCookies(req);
    token = cookies['smarthub_token'] || req.headers['x-auth-token'] || req.query.token;
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
      let user = db.findOne('users', u => u.id === decoded.id || (decoded.email && u.email && u.email.toLowerCase() === decoded.email.toLowerCase()));
      if (user) {
        return { user, authType: 'jwt' };
      }
      // If user not in local memory, use verified JWT claims directly
      if (decoded && decoded.id) {
        user = {
          id: decoded.id,
          name: decoded.name || (decoded.email ? decoded.email.split('@')[0] : 'Creator'),
          username: decoded.username || ('@' + (decoded.email ? decoded.email.split('@')[0] : 'user')),
          email: decoded.email || '',
          role: decoded.role || 'buyer',
          walletBalance: Number(decoded.walletBalance) || 0,
          avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(decoded.id)}&backgroundColor=ff5b36`
        };
        return { user, authType: 'jwt' };
      }
    } catch (err) {
      // Invalid or expired JWT
    }
  }

  // Unauthenticated - no client header forgery permitted
  return null;
}

// Scope-based Authorization Middleware
function requireScope(requiredScope) {
  return function (req, res, next) {
    // If authenticated via API Key, enforce scope checks
    if (req.apiKey) {
      const keyScope = req.apiKey.scope || 'full_access';

      if (keyScope === 'read_only' && !['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        return res.status(403).json({
          success: false,
          error: `Forbidden: API Key has 'read_only' scope. Mutating requests (${req.method}) require 'read_write' or 'full_access' scope.`
        });
      }

      if (requiredScope === 'admin' && keyScope !== 'admin') {
        return res.status(403).json({
          success: false,
          error: "Forbidden: API Key does not possess 'admin' scope."
        });
      }

      if (requiredScope === 'read_write' && keyScope === 'read_only') {
        return res.status(403).json({
          success: false,
          error: "Forbidden: API Key requires 'read_write' or 'full_access' scope."
        });
      }
    }

    if (requiredScope === 'admin' && (!req.user || req.user.role !== 'admin')) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Admin privileges required.'
      });
    }

    next();
  };
}

// Required Authentication Middleware
function authRequired(req, res, next) {
  const authContext = resolveAuthContext(req);
  if (authContext && authContext.user) {
    req.user = authContext.user;
    req.apiKey = authContext.apiKey || null;
    req.authType = authContext.authType;

    // Automatic write safety check for read_only API keys
    if (req.apiKey && req.apiKey.scope === 'read_only' && !['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      return res.status(403).json({
        success: false,
        error: `Forbidden: API Key has 'read_only' scope. Mutating requests (${req.method}) require 'read_write' or 'full_access' scope.`
      });
    }

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

    // Automatic write safety check for read_only API keys
    if (req.apiKey && req.apiKey.scope === 'read_only' && !['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      return res.status(403).json({
        success: false,
        error: `Forbidden: API Key has 'read_only' scope. Mutating requests (${req.method}) require 'read_write' or 'full_access' scope.`
      });
    }
  }
  next();
}

// Admin Authentication Middleware (Strict Server-Side Role Enforcement)
function adminRequired(req, res, next) {
  authRequired(req, res, () => {
    if (req.user && req.user.role === 'admin') {
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
  requireScope,
  hashApiKey,
  JWT_SECRET
};

