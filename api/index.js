// ============================================================
// Smart Hub — Vercel Serverless Function Bridge
// Routes all /api/* requests to the Express application
// ============================================================

const express = require('express');
const app = require('../server/index');

const handler = express();

// Ensure req.url has /api prefix for Express routing if proxy stripped it
handler.use((req, res, next) => {
  if (req.url && !req.url.startsWith('/api')) {
    req.url = '/api' + (req.url.startsWith('/') ? req.url : '/' + req.url);
  }
  next();
});

handler.use(app);

module.exports = handler;
