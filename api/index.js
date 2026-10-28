// ============================================================
// Smart Hub — Vercel Serverless Function Bridge
// Routes all /api/* requests to the Express application
// ============================================================

const app = require('../server/index');

module.exports = (req, res) => {
  // Ensure req.url has /api prefix for Express routing if proxy stripped it
  if (req && req.url) {
    if (!req.url.startsWith('/api')) {
      req.url = '/api' + (req.url.startsWith('/') ? req.url : '/' + req.url);
    }
  }
  return app(req, res);
};
