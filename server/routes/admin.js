const express = require('express');
const router = express.Router();
const db = require('../db');
const { adminRequired } = require('../middleware/auth');
const { supabase, isSupabaseConfigured } = require('../supabase');

// All routes in this router require Super Admin credentials
router.use(adminRequired);

// ── 1. Comprehensive System Overview & Metrics ──────────────
router.get('/overview', (req, res) => {
  try {
    const users = db.get('users') || [];
    const products = db.get('products') || [];
    const orders = db.get('orders') || [];
    const transactions = db.get('transactions') || [];
    const apiKeys = db.get('apiKeys') || [];
    const channels = db.get('channels') || [];
    const categories = db.get('categories') || [];

    // Calculate Financials & Activity
    const totalRevenue = transactions
      .filter(t => t.type === 'credit' && t.method !== 'SmartHub Grant')
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

    const totalWalletHeld = users.reduce((sum, u) => sum + (Number(u.walletBalance) || 0), 0);
    const activeKeysCount = apiKeys.filter(k => k.status === 'active').length;

    res.json({
      success: true,
      metrics: {
        totalUsers: users.length,
        adminCount: users.filter(u => u.role === 'admin').length,
        sellerCount: users.filter(u => u.role === 'seller').length,
        buyerCount: users.filter(u => u.role === 'buyer' || !u.role).length,
        totalProducts: products.length,
        totalOrders: orders.length,
        totalTransactions: transactions.length,
        totalRevenueRupees: totalRevenue,
        totalWalletHeldRupees: totalWalletHeld,
        activeApiKeys: activeKeysCount,
        totalChannels: channels.length,
        totalCategories: categories.length,
        supabaseCloudConnected: isSupabaseConfigured(),
        supabaseUrl: process.env.SUPABASE_URL || 'Not configured',
        serverUptimeSeconds: Math.floor(process.uptime()),
        timestamp: new Date().toISOString()
      }
    });
  } catch (err) {
    console.error('[Admin] Overview error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── 2. All Users Directory ───────────────────────────────────
router.get('/users', (req, res) => {
  try {
    const users = db.get('users') || [];
    const apiKeys = db.get('apiKeys') || [];
    const orders = db.get('orders') || [];

    const enrichedUsers = users.map(u => {
      const userKeys = apiKeys.filter(k => k.userId === u.id);
      const userOrders = orders.filter(o => o.buyerId === u.id || o.userId === u.id);
      return {
        id: u.id,
        name: u.name,
        username: u.username,
        email: u.email,
        role: u.role || 'buyer',
        walletBalance: u.walletBalance || 0,
        xp: u.xp || 0,
        badges: u.badges || 0,
        location: u.location || 'India',
        headline: u.headline || 'Developer',
        createdAt: u.createdAt,
        apiKeyCount: userKeys.length,
        orderCount: userOrders.length
      };
    });

    res.json({ success: true, users: enrichedUsers });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── 3. Update User Role (Promote/Demote) ──────────────────────
router.post('/users/:id/role', (req, res) => {
  try {
    const { role } = req.body;
    const validRoles = ['admin', 'seller', 'buyer'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ success: false, error: `Invalid role. Must be one of: ${validRoles.join(', ')}` });
    }

    const user = db.findById('users', req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const updated = db.update('users', user.id, { 
      role,
      headline: role === 'admin' ? 'Platform & Architecture · Super Admin' : user.headline
    });

    res.json({
      success: true,
      message: `User '${user.name}' role updated to '${role}'`,
      user: updated
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── 4. Grant / Adjust Wallet Rupees ──────────────────────────
router.post('/users/:id/wallet', (req, res) => {
  try {
    const { amount, reason } = req.body;
    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount === 0) {
      return res.status(400).json({ success: false, error: 'Valid numeric amount is required' });
    }

    const user = db.findById('users', req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const newBalance = Math.max(0, (Number(user.walletBalance) || 0) + numAmount);
    db.update('users', user.id, { walletBalance: newBalance });

    // Record audit transaction
    db.insert('transactions', {
      id: 't_' + Date.now(),
      userId: user.id,
      type: numAmount > 0 ? 'credit' : 'debit',
      title: reason || (numAmount > 0 ? 'Admin Wallet Grant' : 'Admin Wallet Adjustment'),
      amount: Math.abs(numAmount),
      date: new Date().toISOString().split('T')[0],
      icon: numAmount > 0 ? '💎' : '🔻',
      method: `Admin (${req.user.name})`,
      createdAt: new Date().toISOString()
    });

    res.json({
      success: true,
      message: `Updated wallet for '${user.name}'. New balance: ₹${newBalance}`,
      walletBalance: newBalance
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── 5. All Products & Codebases Catalog ──────────────────────
router.get('/products', (req, res) => {
  try {
    const products = db.get('products') || [];
    res.json({ success: true, products });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete / Moderate Product
router.delete('/products/:id', (req, res) => {
  try {
    const prod = db.findById('products', req.params.id);
    if (!prod) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }
    db.delete('products', req.params.id);
    res.json({ success: true, message: `Product '${prod.title}' removed by administrator.` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── 6. All Orders & Platform Transactions ────────────────────
router.get('/transactions', (req, res) => {
  try {
    const transactions = db.get('transactions') || [];
    const users = db.get('users') || [];
    const userMap = new Map(users.map(u => [u.id, u.name]));

    const enriched = transactions.map(t => ({
      ...t,
      userName: userMap.get(t.userId) || 'Anonymous Developer'
    }));

    res.json({ success: true, transactions: enriched.reverse() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── 7. All Developer API Tokens Across Entire Platform ───────
router.get('/api-keys', (req, res) => {
  try {
    const apiKeys = db.get('apiKeys') || [];
    const users = db.get('users') || [];
    const userMap = new Map(users.map(u => [u.id, { name: u.name, email: u.email, username: u.username }]));

    const enrichedKeys = apiKeys.map(k => {
      const owner = userMap.get(k.userId) || { name: 'Unknown User', email: '—', username: '—' };
      return {
        id: k.id,
        name: k.name,
        keyPrefix: k.keyPrefix,
        lastFour: k.lastFour,
        scope: k.scope,
        status: k.status,
        lastUsedAt: k.lastUsedAt,
        createdAt: k.createdAt,
        ownerName: owner.name,
        ownerEmail: owner.email,
        ownerUsername: owner.username,
        hasEncryptedVault: !!k.encryptedKey
      };
    });

    res.json({ success: true, apiKeys: enrichedKeys });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Revoke any API Key
router.delete('/api-keys/:id', (req, res) => {
  try {
    const key = db.findById('apiKeys', req.params.id);
    if (!key) {
      return res.status(404).json({ success: false, error: 'API key not found' });
    }
    db.delete('apiKeys', req.params.id);
    res.json({ success: true, message: `API Key '${key.name}' successfully revoked by Admin.` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── 8. Raw Database Dump & Collection Explorer ───────────────
router.get('/raw-database', (req, res) => {
  try {
    const raw = db.data;
    // Sanitize password hashes for security in export
    const safeDump = JSON.parse(JSON.stringify(raw));
    if (safeDump.users && Array.isArray(safeDump.users)) {
      safeDump.users.forEach(u => {
        delete u.passwordHash;
      });
    }
    res.json({ success: true, data: safeDump });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── 9. Trigger Cloud Supabase Sync ───────────────────────────
router.post('/sync-supabase', async (req, res) => {
  try {
    if (!isSupabaseConfigured() || !supabase) {
      return res.status(400).json({ 
        success: false, 
        error: 'Supabase credentials are not configured in .env' 
      });
    }

    const categories = db.get('categories') || [];
    const channels = db.get('channels') || [];
    const challenges = db.get('challenges') || [];

    let synced = { categories: 0, channels: 0, challenges: 0 };

    if (categories.length > 0) {
      const { data } = await supabase.from('categories').upsert(categories, { onConflict: 'name' });
      synced.categories = categories.length;
    }

    if (channels.length > 0) {
      const channelRows = channels.map(c => ({
        id: c.id,
        name: c.name,
        description: c.description || '',
        category: c.category || 'General',
        icon: c.icon || '💬'
      }));
      await supabase.from('channels').upsert(channelRows, { onConflict: 'id' });
      synced.channels = channelRows.length;
    }

    res.json({
      success: true,
      message: 'Cloud sync to Supabase completed successfully!',
      synced
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
