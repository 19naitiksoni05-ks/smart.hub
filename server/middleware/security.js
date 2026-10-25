const crypto = require('crypto');

// ── In-Memory Rate Limiting Engine ───────────────────────────
// Sliding window rate limiter per client IP
class SlidingWindowRateLimiter {
  constructor(windowMs, maxRequests) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    this.hits = new Map();

    // Periodic cleanup of stale IPs every 5 minutes
    setInterval(() => this.cleanup(), 5 * 60 * 1000).unref();
  }

  cleanup() {
    const now = Date.now();
    for (const [key, records] of this.hits.entries()) {
      const activeRecords = records.filter(ts => now - ts < this.windowMs);
      if (activeRecords.length === 0) {
        this.hits.delete(key);
      } else {
        this.hits.set(key, activeRecords);
      }
    }
  }

  isAllowed(key) {
    const now = Date.now();
    const timestamps = this.hits.get(key) || [];
    const windowStart = now - this.windowMs;
    const recent = timestamps.filter(ts => ts > windowStart);

    if (recent.length >= this.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        retryAfterMs: Math.max(1000, recent[0] + this.windowMs - now)
      };
    }

    recent.push(now);
    this.hits.set(key, recent);
    return {
      allowed: true,
      remaining: this.maxRequests - recent.length,
      retryAfterMs: 0
    };
  }
}

// Global API limiter: 150 requests per minute per IP
const globalLimiter = new SlidingWindowRateLimiter(60 * 1000, 150);

// Sensitive Auth/Checkout limiter: 20 requests per minute per IP
const authLimiter = new SlidingWindowRateLimiter(60 * 1000, 20);

// Brute-force Login Guard: Locks identity after 5 consecutive failed attempts for 5 minutes
const loginAttempts = new Map();

function recordFailedLogin(identity) {
  if (!identity) return;
  const key = identity.toLowerCase().trim();
  const record = loginAttempts.get(key) || { count: 0, lockedUntil: 0 };
  record.count += 1;
  if (record.count >= 5) {
    record.lockedUntil = Date.now() + 5 * 60 * 1000; // 5 min lockout
  }
  loginAttempts.set(key, record);
}

function clearFailedLogin(identity) {
  if (!identity) return;
  loginAttempts.delete(identity.toLowerCase().trim());
}

function checkLoginLockout(identity) {
  if (!identity) return { locked: false };
  const key = identity.toLowerCase().trim();
  const record = loginAttempts.get(key);
  if (!record) return { locked: false };

  if (record.lockedUntil > Date.now()) {
    const remainingSec = Math.ceil((record.lockedUntil - Date.now()) / 1000);
    return {
      locked: true,
      error: `Too many failed login attempts for this account. Locked for security. Try again in ${remainingSec} seconds.`
    };
  }

  if (record.lockedUntil > 0 && record.lockedUntil <= Date.now()) {
    loginAttempts.delete(key);
  }
  return { locked: false };
}

// ── Security Headers Middleware ──────────────────────────────
function securityHeaders(req, res, next) {
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // Prevent clickjacking in iframes except from same origin
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  // Enable browser XSS filter
  res.setHeader('X-XSS-Protection', '1; mode=block');
  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  // HSTS in production or over HTTPS
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  // Content Security Policy (allows inline scripts/styles needed for UI, restricts dangerous framing)
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  res.setHeader('X-Download-Options', 'noopen');

  next();
}

// ── Global Rate Limit Middleware ─────────────────────────────
function rateLimitGlobal(req, res, next) {
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
  const result = globalLimiter.isAllowed(clientIp);

  res.setHeader('X-RateLimit-Limit', '150');
  res.setHeader('X-RateLimit-Remaining', String(result.remaining));

  if (!result.allowed) {
    const retrySec = Math.ceil(result.retryAfterMs / 1000);
    res.setHeader('Retry-After', String(retrySec));
    return res.status(429).json({
      success: false,
      error: `Too Many Requests: Rate limit exceeded. Please wait ${retrySec} seconds before retrying.`
    });
  }
  next();
}

// ── Sensitive Auth / Mutation Rate Limit Middleware ──────────
function rateLimitAuth(req, res, next) {
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
  const result = authLimiter.isAllowed('auth_' + clientIp);

  if (!result.allowed) {
    const retrySec = Math.ceil(result.retryAfterMs / 1000);
    res.setHeader('Retry-After', String(retrySec));
    return res.status(429).json({
      success: false,
      error: `Security Alert: Too many authorization or critical requests from this IP. Please wait ${retrySec} seconds.`
    });
  }
  next();
}

// ── Anti-Prototype Pollution & Input Sanitization ────────────
function deepSanitize(target) {
  if (!target || typeof target !== 'object') return target;

  if (Array.isArray(target)) {
    return target.map(deepSanitize);
  }

  const clean = {};
  for (const [key, value] of Object.entries(target)) {
    // Block Prototype Pollution vectors
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      continue;
    }

    if (typeof value === 'string') {
      // Strip dangerous active script tags while preserving legitimate code snippets
      let str = value
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/javascript:[^"']*/gi, '');
      clean[key] = str;
    } else if (typeof value === 'object' && value !== null) {
      clean[key] = deepSanitize(value);
    } else {
      clean[key] = value;
    }
  }
  return clean;
}

function inputSanitizer(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    req.body = deepSanitize(req.body);
  }
  if (req.query && typeof req.query === 'object') {
    req.query = deepSanitize(req.query);
  }
  next();
}

module.exports = {
  securityHeaders,
  rateLimitGlobal,
  rateLimitAuth,
  inputSanitizer,
  recordFailedLogin,
  clearFailedLogin,
  checkLoginLockout
};
