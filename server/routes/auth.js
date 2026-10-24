const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { supabase, isConfigured: isSupabaseConfigured } = require('../supabase');
const { JWT_SECRET, authRequired, hashApiKey } = require('../middleware/auth');

function sanitizeUser(user) {
  if (!user) return null;
  const { passwordHash, ...safeUser } = user;
  return safeUser;
}

// ── 1. Register Account ───────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { name, username, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, error: 'Name, email and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, error: 'Password must be at least 6 characters long' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanUsername = (username || ('@' + cleanEmail.split('@')[0])).trim();

    // Check if user already exists
    const existing = db.findOne('users', u => 
      u.email.toLowerCase() === cleanEmail || 
      u.username.toLowerCase() === cleanUsername.toLowerCase()
    );
    if (existing) {
      return res.status(400).json({ success: false, error: 'An account with this email or username already exists' });
    }

    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(password, salt);

    // Optional Supabase Auth integration
    let supabaseAuthId = null;
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data: sbAuth, error: sbErr } = await supabase.auth.signUp({
          email: cleanEmail,
          password: password,
          options: {
            data: {
              name,
              username: cleanUsername
            }
          }
        });
        if (!sbErr && sbAuth && sbAuth.user) {
          supabaseAuthId = sbAuth.user.id;
        }
      } catch (authErr) {
        console.warn('[Supabase Auth] SignUp notice:', authErr.message);
      }
    }

    const newUser = {
      id: supabaseAuthId || ('u_' + Date.now()),
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

    // Auto-generate starter Developer API Key
    const rawApiKey = 'sh_live_' + crypto.randomBytes(20).toString('hex');
    const starterApiKey = {
      id: 'key_' + Date.now(),
      userId: newUser.id,
      name: 'Default Production Key',
      keyHash: hashApiKey(rawApiKey),
      keyPrefix: rawApiKey.slice(0, 12),
      lastFour: rawApiKey.slice(-4),
      scope: 'full_access',
      status: 'active',
      lastUsedAt: null,
      createdAt: new Date().toISOString()
    };
    db.insert('apiKeys', starterApiKey);

    const token = jwt.sign(
      { id: newUser.id, email: newUser.email, role: newUser.role },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    // Broadcast user registration to active WebSocket clients
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
      message: 'Account created successfully! ₹500 credited to your rupee wallet.',
      token,
      apiKey: {
        id: starterApiKey.id,
        name: starterApiKey.name,
        rawKey: rawApiKey,
        keyPrefix: starterApiKey.keyPrefix,
        lastFour: starterApiKey.lastFour
      },
      user: sanitizeUser(newUser)
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ success: false, error: 'Internal server error during registration' });
  }
});

// ── 2. Login Account ──────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const identity = req.body.identity || req.body.email || req.body.username;
    const { password } = req.body;

    if (!identity || !password) {
      return res.status(400).json({ success: false, error: 'Identity (email/username) and password are required' });
    }

    const cleanIdentity = identity.trim().toLowerCase();
    let user = db.findOne('users', u => 
      u.email.toLowerCase() === cleanIdentity || 
      u.username.toLowerCase() === cleanIdentity ||
      u.username.toLowerCase() === ('@' + cleanIdentity)
    );

    // Supabase fallback check if user exists in cloud but not local
    if (!user && isSupabaseConfigured() && supabase) {
      try {
        const { data: cloudUsers } = await supabase
          .from('users')
          .select('*')
          .or(`email.ilike.${cleanIdentity},username.ilike.${cleanIdentity}`)
          .limit(1);

        if (cloudUsers && cloudUsers.length > 0) {
          const cu = cloudUsers[0];
          user = {
            id: cu.id,
            name: cu.name,
            username: cu.username,
            email: cu.email,
            passwordHash: cu.password_hash,
            avatar: cu.avatar,
            walletBalance: cu.wallet_balance || 0,
            role: cu.role || 'buyer',
            xp: cu.xp || 0,
            badges: cu.badges || 0,
            location: cu.location || 'India',
            headline: cu.headline || 'Developer'
          };
          db.insert('users', user);
        }
      } catch (e) {}
    }

    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    // Verify password
    const isMatch = bcrypt.compareSync(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    // Also attempt Supabase Auth sign-in if configured
    if (isSupabaseConfigured() && supabase && user.email) {
      try {
        await supabase.auth.signInWithPassword({
          email: user.email,
          password: password
        });
      } catch (sbErr) {}
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      success: true,
      message: `Welcome back, ${user.name}!`,
      token,
      user: sanitizeUser(user)
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, error: 'Internal server error during login' });
  }
});

// ── 3. Get Current Authenticated Profile ──────────────────────
router.get('/me', authRequired, (req, res) => {
  const userKeys = db.find('apiKeys', k => k.userId === req.user.id && k.status === 'active');

  res.json({
    success: true,
    user: sanitizeUser(req.user),
    authType: req.authType,
    apiKey: req.apiKey ? { id: req.apiKey.id, name: req.apiKey.name, scope: req.apiKey.scope } : null,
    activeApiKeysCount: userKeys.length
  });
});

// ── 4. Refresh JWT Token ─────────────────────────────────────
router.post('/refresh', authRequired, (req, res) => {
  const token = jwt.sign(
    { id: req.user.id, email: req.user.email, role: req.user.role },
    JWT_SECRET,
    { expiresIn: '30d' }
  );

  res.json({
    success: true,
    message: 'Token refreshed successfully',
    token
  });
});

// ── 5. Change Password ───────────────────────────────────────
router.post('/change-password', authRequired, (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, error: 'Both current password and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, error: 'New password must be at least 6 characters long' });
    }

    const user = db.findById('users', req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const isMatch = bcrypt.compareSync(currentPassword, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ success: false, error: 'Current password does not match' });
    }

    const salt = bcrypt.genSaltSync(10);
    const newHash = bcrypt.hashSync(newPassword, salt);

    db.update('users', req.user.id, { passwordHash: newHash });

    res.json({
      success: true,
      message: 'Password changed successfully! You can now use your new password.'
    });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ success: false, error: 'Failed to change password' });
  }
});

// ── 6. Update Profile ────────────────────────────────────────
router.put('/profile', authRequired, (req, res) => {
  try {
    const { name, headline, location, avatar, bio, website, upiId } = req.body;
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (headline !== undefined) updates.headline = headline;
    if (location !== undefined) updates.location = location;
    if (avatar !== undefined) updates.avatar = avatar;
    if (bio !== undefined) updates.bio = bio;
    if (website !== undefined) updates.website = website;
    if (upiId !== undefined) updates.upiId = upiId;

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

// ── 7. DEVELOPER API KEYS: List User Keys ────────────────────
router.get('/api-keys', authRequired, (req, res) => {
  try {
    const keys = db.find('apiKeys', k => k.userId === req.user.id);
    // Never expose the full raw secret or keyHash in list requests
    const safeKeys = keys.map(k => ({
      id: k.id,
      name: k.name || 'API Key',
      keyPrefix: k.keyPrefix,
      lastFour: k.lastFour,
      scope: k.scope || 'full_access',
      status: k.status || 'active',
      createdAt: k.createdAt,
      lastUsedAt: k.lastUsedAt
    }));

    res.json({
      success: true,
      apiKeys: safeKeys
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch API keys' });
  }
});

// ── 8. DEVELOPER API KEYS: Generate New Key ──────────────────
router.post('/api-keys', authRequired, (req, res) => {
  try {
    const { name, scope } = req.body;
    const keyName = (name || 'New API Key').trim();
    const keyScope = scope || 'full_access';

    // Generate 24 random bytes (48 hex characters)
    const rawKey = 'sh_live_' + crypto.randomBytes(24).toString('hex');
    const keyHash = hashApiKey(rawKey);
    const keyPrefix = rawKey.slice(0, 12);
    const lastFour = rawKey.slice(-4);

    const newKey = {
      id: 'key_' + Date.now(),
      userId: req.user.id,
      name: keyName,
      keyHash,
      keyPrefix,
      lastFour,
      scope: keyScope,
      status: 'active',
      lastUsedAt: null,
      createdAt: new Date().toISOString()
    };

    db.insert('apiKeys', newKey);

    res.status(201).json({
      success: true,
      message: 'Developer API key created! Make sure to copy it now, it will not be displayed again.',
      apiKey: {
        id: newKey.id,
        name: newKey.name,
        rawKey, // Returned ONLY on creation!
        keyPrefix,
        lastFour,
        scope: newKey.scope,
        createdAt: newKey.createdAt
      }
    });
  } catch (err) {
    console.error('Create API key error:', err);
    res.status(500).json({ success: false, error: 'Failed to generate API key' });
  }
});

// ── 9. DEVELOPER API KEYS: Revoke / Delete Key ───────────────
router.delete('/api-keys/:id', authRequired, (req, res) => {
  try {
    const keyId = req.params.id;
    const keyRecord = db.findById('apiKeys', keyId);

    if (!keyRecord || keyRecord.userId !== req.user.id) {
      return res.status(404).json({ success: false, error: 'API key not found' });
    }

    db.delete('apiKeys', keyId);

    res.json({
      success: true,
      message: `API Key '${keyRecord.name}' revoked successfully`
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to revoke API key' });
  }
});

// ── 10. List Registered Users (Public Directory) ─────────────
router.get('/users', (req, res) => {
  const users = db.get('users').map(sanitizeUser);
  res.json({ success: true, users });
});

module.exports = router;
