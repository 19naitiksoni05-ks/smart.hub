const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { JWT_SECRET, authRequired } = require('../middleware/auth');

function sanitizeUser(user) {
  if (!user) return null;
  const { passwordHash, ...safeUser } = user;
  return safeUser;
}

// ── Register ─────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { name, username, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, error: 'Name, email and password are required' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanUsername = (username || ('@' + cleanEmail.split('@')[0])).trim();

    // Check if user already exists
    const existing = db.findOne('users', u => u.email.toLowerCase() === cleanEmail || u.username.toLowerCase() === cleanUsername.toLowerCase());
    if (existing) {
      return res.status(400).json({ success: false, error: 'An account with this email or username already exists' });
    }

    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(password, salt);

    const newUser = {
      id: 'u_' + Date.now(),
      name,
      username: cleanUsername.startsWith('@') ? cleanUsername : '@' + cleanUsername,
      email: cleanEmail,
      passwordHash,
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(cleanUsername)}&backgroundColor=ff5b36`,
      walletBalance: 500, // ₹500 welcome bonus!
      role: role || 'buyer',
      xp: 0,
      badges: 0,
      location: 'India',
      headline: 'Smart Hub Developer',
      createdAt: new Date().toISOString()
    };

    db.insert('users', newUser);

    // Record welcome bonus transaction
    db.insert('transactions', {
      id: 't_' + Date.now(),
      userId: newUser.id,
      type: 'credit',
      title: '🎁 Welcome Bonus Credited',
      amount: 500,
      date: new Date().toISOString().split('T')[0],
      icon: '🎁',
      method: 'SmartHub Grant'
    });

    const token = jwt.sign({ id: newUser.id, email: newUser.email, role: newUser.role }, JWT_SECRET, { expiresIn: '30d' });

    // Broadcast user registration to active clients
    try {
      const broadcastWs = req.app.get('broadcastWs');
      if (broadcastWs) {
        broadcastWs({
          type: 'USER_REGISTERED',
          usersCount: (db.get('users') || []).length
        });
      }
    } catch (wsErr) {}

    res.status(201).json({
      success: true,
      message: 'Account created successfully! ₹500 credited to wallet.',
      token,
      user: sanitizeUser(newUser)
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ── Login ────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const identity = req.body.identity || req.body.email || req.body.username;
    const { password } = req.body;

    if (!identity || !password) {
      return res.status(400).json({ success: false, error: 'Identity (email/username) and password are required' });
    }

    const cleanIdentity = identity.trim().toLowerCase();
    const user = db.findOne('users', u => 
      u.email.toLowerCase() === cleanIdentity || 
      u.username.toLowerCase() === cleanIdentity ||
      u.username.toLowerCase() === ('@' + cleanIdentity)
    );

    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    // Verify password
    const isMatch = bcrypt.compareSync(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '30d' });

    res.json({
      success: true,
      message: `Welcome back, ${user.name}!`,
      token,
      user: sanitizeUser(user)
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ── Get Current Authenticated User ────────────────────────────
router.get('/me', authRequired, (req, res) => {
  res.json({
    success: true,
    user: sanitizeUser(req.user)
  });
});

// ── Update Profile ───────────────────────────────────────────
router.put('/profile', authRequired, (req, res) => {
  try {
    const { name, headline, location, avatar } = req.body;
    const updates = {};
    if (name) updates.name = name;
    if (headline) updates.headline = headline;
    if (location) updates.location = location;
    if (avatar) updates.avatar = avatar;

    const updated = db.update('users', req.user.id, updates);
    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: sanitizeUser(updated)
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update profile' });
  }
});

// ── Registered Users List ─────────────────────────────────────
router.get('/users', (req, res) => {
  const users = db.get('users').map(sanitizeUser);
  res.json({ success: true, users });
});

module.exports = router;
