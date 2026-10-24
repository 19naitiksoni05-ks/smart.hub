const express = require('express');
const router = express.Router();
const db = require('../db');
const { authRequired, authOptional } = require('../middleware/auth');

// ── Get Wallet Overview & Transactions ────────────────────────
router.get('/', authOptional, (req, res) => {
  try {
    const user = req.user || null;
    if (!user) {
      return res.json({
        success: true,
        wallet: {
          balance: 0,
          currency: 'INR',
          symbol: '₹',
          totalEarned: 0,
          totalSpent: 0,
          withdrawn: 0,
          transactionFeePercent: 0,
          upiLinked: false,
          upiId: ''
        },
        transactions: []
      });
    }

    const transactions = db.find('transactions', t => t.userId === user.id);

    // Calculate dynamic stats from real transactions
    const totalEarned = transactions
      .filter(t => t.type === 'credit' && t.title.toLowerCase().includes('sale'))
      .reduce((sum, t) => sum + t.amount, 0);

    const totalSpent = transactions
      .filter(t => t.type === 'debit' && t.title.toLowerCase().includes('purchase'))
      .reduce((sum, t) => sum + t.amount, 0);

    const withdrawn = transactions
      .filter(t => t.type === 'debit' && t.title.toLowerCase().includes('withdrawal'))
      .reduce((sum, t) => sum + t.amount, 0);

    res.json({
      success: true,
      wallet: {
        balance: user.walletBalance || 0,
        currency: 'INR',
        symbol: '₹',
        totalEarned,
        totalSpent,
        withdrawn,
        transactionFeePercent: 0,
        upiLinked: Boolean(user.upiId),
        upiId: user.upiId || `${(user.username || 'user').replace('@', '')}@upi`
      },
      transactions
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to retrieve wallet details' });
  }
});

// ── Top-up Wallet ─────────────────────────────────────────────
router.post('/topup', authOptional, (req, res) => {
  try {
    const { amount, method = 'UPI' } = req.body;
    const numAmount = Number(amount);

    if (!numAmount || numAmount < 10) {
      return res.status(400).json({ success: false, error: 'Minimum top-up amount is ₹10' });
    }

    const user = req.user || null;
    if (!user) {
      return res.status(401).json({ success: false, error: 'Please log in to top up your wallet' });
    }

    const newBalance = (user.walletBalance || 0) + numAmount;
    db.update('users', user.id, { walletBalance: newBalance });

    const newTx = {
      id: 't_' + Date.now(),
      userId: user.id,
      type: 'credit',
      title: `Wallet Top-up (${method.toUpperCase()})`,
      amount: numAmount,
      date: new Date().toISOString().split('T')[0],
      icon: '➕',
      method: method.toUpperCase(),
      createdAt: new Date().toISOString()
    };

    db.insert('transactions', newTx);

    res.json({
      success: true,
      message: `₹${numAmount.toLocaleString('en-IN')} added to your wallet! 🎉`,
      newBalance,
      transaction: newTx
    });
  } catch (err) {
    console.error('Topup error:', err);
    res.status(500).json({ success: false, error: 'Top-up failed' });
  }
});

// ── Transfer to Another User ─────────────────────────────────
router.post('/transfer', authOptional, (req, res) => {
  try {
    const { recipient, amount } = req.body;
    const numAmount = Number(amount);

    if (!recipient || !numAmount || numAmount < 1) {
      return res.status(400).json({ success: false, error: 'Valid recipient and amount are required' });
    }

    const sender = req.user || null;
    if (!sender) {
      return res.status(401).json({ success: false, error: 'Please log in to transfer funds' });
    }

    if ((sender.walletBalance || 0) < numAmount) {
      return res.status(400).json({ success: false, error: 'Insufficient balance for transfer' });
    }

    // Find recipient
    const cleanRecip = recipient.trim().toLowerCase();
    const targetUser = db.findOne('users', u =>
      u.email.toLowerCase() === cleanRecip ||
      u.username.toLowerCase() === cleanRecip ||
      u.username.toLowerCase() === ('@' + cleanRecip)
    );

    if (!targetUser) {
      return res.status(404).json({ success: false, error: `Recipient "${recipient}" not found on Smart Hub` });
    }

    // Deduct sender
    const newSenderBal = sender.walletBalance - numAmount;
    db.update('users', sender.id, { walletBalance: newSenderBal });

    db.insert('transactions', {
      id: 't_out_' + Date.now(),
      userId: sender.id,
      type: 'debit',
      title: `Transfer to ${targetUser.name}`,
      amount: numAmount,
      date: new Date().toISOString().split('T')[0],
      icon: '↗️',
      method: 'Peer Transfer'
    });

    // Credit recipient
    db.update('users', targetUser.id, { walletBalance: (targetUser.walletBalance || 0) + numAmount });
    db.insert('transactions', {
      id: 't_in_' + Date.now(),
      userId: targetUser.id,
      type: 'credit',
      title: `Transfer from ${sender.name}`,
      amount: numAmount,
      date: new Date().toISOString().split('T')[0],
      icon: '💸',
      method: 'Peer Transfer'
    });

    res.json({
      success: true,
      message: `₹${numAmount.toLocaleString('en-IN')} transferred successfully to ${targetUser.name}!`,
      newBalance: newSenderBal
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Transfer failed' });
  }
});

// ── Withdraw to Bank / UPI ────────────────────────────────────
router.post('/withdraw', authOptional, (req, res) => {
  try {
    const { amount, upiId } = req.body;
    const numAmount = Number(amount);

    if (!numAmount || numAmount < 100) {
      return res.status(400).json({ success: false, error: 'Minimum withdrawal amount is ₹100' });
    }

    const user = req.user || null;
    if (!user) {
      return res.status(401).json({ success: false, error: 'Please log in to withdraw funds' });
    }

    if ((user.walletBalance || 0) < numAmount) {
      return res.status(400).json({ success: false, error: 'Insufficient wallet balance' });
    }

    const newBal = user.walletBalance - numAmount;
    db.update('users', user.id, { walletBalance: newBal });

    const tx = {
      id: 't_w_' + Date.now(),
      userId: user.id,
      type: 'debit',
      title: `Bank/UPI Withdrawal`,
      amount: numAmount,
      date: new Date().toISOString().split('T')[0],
      icon: '🏦',
      method: upiId ? `UPI (${upiId})` : 'IMPS Bank Transfer'
    };
    db.insert('transactions', tx);

    res.json({
      success: true,
      message: `Withdrawal of ₹${numAmount.toLocaleString('en-IN')} initiated to ${upiId || 'registered bank account'}. Arriving within 15 minutes!`,
      newBalance: newBal,
      transaction: tx
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Withdrawal failed' });
  }
});

module.exports = router;
