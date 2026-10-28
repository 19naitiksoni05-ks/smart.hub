const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const db = require('../db');
const { supabase, isConfigured } = require('../supabase');

// ── Subscribe to Newsletter ──────────────────────────────────
router.post('/subscribe', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== 'string' || !email.includes('@') || !email.includes('.')) {
      return res.status(400).json({ success: false, error: 'Please enter a valid email address' });
    }

    const cleanEmail = email.toLowerCase().trim();

    // Check existing in local db
    let subscribers = db.get('newsletter') || [];
    const exists = subscribers.some(s => s.email === cleanEmail && s.status === 'active');
    if (exists) {
      return res.status(200).json({
        success: true,
        alreadySubscribed: true,
        message: 'You are already subscribed to Smart Hub releases! 🚀'
      });
    }

    const record = {
      id: 'sub_' + Date.now(),
      email: cleanEmail,
      status: 'active',
      token: crypto.randomBytes(16).toString('hex'),
      createdAt: new Date().toISOString()
    };

    db.insert('newsletter', record);

    // Optional Supabase persistence
    if (isConfigured() && supabase) {
      try {
        await supabase.from('newsletter_subscribers').upsert([{
          id: record.id,
          email: record.email,
          status: 'active',
          token: record.token,
          created_at: record.createdAt
        }], { onConflict: 'email' });
      } catch (sbErr) {
        // Non-blocking if table doesn't exist yet
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Successfully subscribed to weekly Smart Hub developer updates! 📬'
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Subscription service temporarily unavailable' });
  }
});

// ── Unsubscribe ──────────────────────────────────────────────
router.get('/unsubscribe', (req, res) => {
  const { email, token } = req.query;
  if (!email) {
    return res.status(400).send('<h3>Invalid unsubscribe request: Email required</h3>');
  }

  const cleanEmail = String(email).toLowerCase().trim();
  const sub = db.findOne('newsletter', s => s.email === cleanEmail);
  if (sub) {
    db.update('newsletter', sub.id, { status: 'unsubscribed', unsubscribedAt: new Date().toISOString() });
  }

  return res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Unsubscribed — Smart Hub</title>
      <style>
        body { font-family: -apple-system, sans-serif; background: #0f141c; color: #fff; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
        .box { background: #161c28; border: 1px solid #2d3748; border-radius: 12px; padding: 36px; text-align: center; max-width: 420px; }
        h2 { color: #61dafb; margin-top: 0; }
        a { color: #ff5b36; text-decoration: none; font-weight: 600; }
      </style>
    </head>
    <body>
      <div class="box">
        <h2>Unsubscribed Successfully</h2>
        <p>You have been removed from the Smart Hub weekly newsletter.</p>
        <p><a href="/">← Return to Smart Hub Homepage</a></p>
      </div>
    </body>
    </html>
  `);
});

module.exports = router;

