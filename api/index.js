// ============================================================
// Smart Hub — Vercel Serverless Function Bridge
// Routes all /api/* requests to the Express application
// ============================================================

let app;
let initError = null;

try {
  app = require('../server/index');
} catch (err) {
  initError = err;
  console.error('[Vercel Bridge Init Error]', err);
}

module.exports = (req, res) => {
  if (initError) {
    return res.status(500).json({
      error: 'Vercel Function Init Error',
      message: initError.message,
      stack: initError.stack
    });
  }

  try {
    return app(req, res);
  } catch (runErr) {
    return res.status(500).json({
      error: 'Vercel Runtime Error',
      message: runErr.message,
      stack: runErr.stack
    });
  }
};
