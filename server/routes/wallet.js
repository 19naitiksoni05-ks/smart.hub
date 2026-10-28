const express = require('express');
const router = express.Router();
const db = require('../db');
const { authRequired, authOptional } = require('../middleware/auth');
const { supabase, isSupabaseConfigured } = require('../supabase');

// ── Get Wallet Overview & Transactions ────────────────────────
router.get('/', authOptional, async (req, res) => {
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

    let currentBalance = Number(user.walletBalance) || 0;
    let upiId = user.upiId || '';

    // Live query from Supabase cloud database
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data: sbUser } = await supabase
          .from('users')
          .select('wallet_balance, upi_id')
          .or(`id.eq.${user.id},email.eq.${user.email}`)
          .maybeSingle();

        if (sbUser && sbUser.wallet_balance !== null && sbUser.wallet_balance !== undefined) {
          currentBalance = Number(sbUser.wallet_balance) || 0;
          user.walletBalance = currentBalance;
          if (sbUser.upi_id) {
            upiId = sbUser.upi_id;
            user.upiId = upiId;
          }
        }
      } catch (err) {
        console.warn('[Wallet GET] Supabase user query error:', err.message);
      }
    }

    let transactions = db.find('transactions', t => t.userId === user.id) || [];

    // Live transactions from Supabase
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data: sbTx } = await supabase
          .from('transactions')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (sbTx && sbTx.length > 0) {
          transactions = sbTx.map(t => ({
            id: t.id,
            userId: t.user_id,
            type: t.type,
            title: t.title,
            amount: Number(t.amount) || 0,
            date: t.date || (t.created_at ? t.created_at.split('T')[0] : new Date().toISOString().split('T')[0]),
            icon: t.type === 'credit' ? '➕' : (t.title && t.title.toLowerCase().includes('withdrawal') ? '🏦' : '↗️'),
            status: t.status || 'completed',
            method: t.reference_id || 'UPI',
            createdAt: t.created_at
          }));
        }
      } catch (err) {
        console.warn('[Wallet GET] Supabase tx query error:', err.message);
      }
    }

    // Calculate dynamic stats from real transactions
    const totalEarned = transactions
      .filter(t => t.type === 'credit' && (t.title.toLowerCase().includes('sale') || t.title.toLowerCase().includes('earning')))
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

    const totalSpent = transactions
      .filter(t => t.type === 'debit' && (t.title.toLowerCase().includes('purchase') || t.title.toLowerCase().includes('transfer')))
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

    const withdrawn = transactions
      .filter(t => t.type === 'debit' && t.title.toLowerCase().includes('withdrawal'))
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

    res.json({
      success: true,
      wallet: {
        balance: currentBalance,
        currency: 'INR',
        symbol: '₹',
        totalEarned,
        totalSpent,
        withdrawn,
        transactionFeePercent: 0,
        upiLinked: Boolean(upiId),
        upiId: upiId || `${(user.username || 'user').replace('@', '')}@upi`
      },
      transactions
    });
  } catch (err) {
    console.error('[Wallet GET] Error:', err);
    res.status(500).json({ success: false, error: 'Failed to retrieve wallet details' });
  }
});

// ── Top-up Wallet ─────────────────────────────────────────────
router.post('/topup', authOptional, async (req, res) => {
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

    // Fetch genuine current balance from Supabase first
    let currentBal = Number(user.walletBalance) || 0;
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data: sbUser } = await supabase
          .from('users')
          .select('wallet_balance')
          .or(`id.eq.${user.id},email.eq.${user.email}`)
          .maybeSingle();

        if (sbUser && sbUser.wallet_balance !== null && sbUser.wallet_balance !== undefined) {
          currentBal = Number(sbUser.wallet_balance) || 0;
        }
      } catch (e) {
        console.warn('[Wallet Topup] Balance fetch notice:', e.message);
      }
    }

    const newBalance = currentBal + numAmount;

    // Directly persist to Supabase cloud
    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase
          .from('users')
          .update({ wallet_balance: newBalance })
          .or(`id.eq.${user.id},email.eq.${user.email}`);
      } catch (sbErr) {
        console.warn('[Wallet Topup] Supabase user balance update error:', sbErr.message);
      }
    }

    user.walletBalance = newBalance;
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

    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase.from('transactions').insert([{
          id: newTx.id,
          user_id: user.id,
          type: newTx.type,
          title: newTx.title,
          amount: newTx.amount,
          date: newTx.date,
          status: 'completed',
          reference_id: method.toUpperCase(),
          created_at: newTx.createdAt
        }]);
      } catch (txErr) {
        console.warn('[Wallet Topup] Supabase transaction insert error:', txErr.message);
      }
    }

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
router.post('/transfer', authOptional, async (req, res) => {
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

    // Fetch sender's live balance from Supabase
    let senderBal = Number(sender.walletBalance) || 0;
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data: sbSender } = await supabase
          .from('users')
          .select('wallet_balance')
          .or(`id.eq.${sender.id},email.eq.${sender.email}`)
          .maybeSingle();

        if (sbSender && sbSender.wallet_balance !== null && sbSender.wallet_balance !== undefined) {
          senderBal = Number(sbSender.wallet_balance) || 0;
        }
      } catch (e) {}
    }

    if (senderBal < numAmount) {
      return res.status(400).json({ success: false, error: 'Insufficient balance for transfer' });
    }

    // Find recipient locally or in Supabase
    const cleanRecip = recipient.trim().toLowerCase();
    let targetUser = db.findOne('users', u =>
      (u.email && u.email.toLowerCase() === cleanRecip) ||
      (u.username && u.username.toLowerCase() === cleanRecip) ||
      (u.username && u.username.toLowerCase() === ('@' + cleanRecip))
    );

    let targetBal = 0;
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data: sbTarget } = await supabase
          .from('users')
          .select('*')
          .or(`email.eq.${cleanRecip},username.eq.${cleanRecip},username.eq.@${cleanRecip.replace(/^@/, '')}`)
          .maybeSingle();

        if (sbTarget) {
          targetUser = {
            id: sbTarget.id,
            name: sbTarget.name,
            email: sbTarget.email,
            username: sbTarget.username,
            walletBalance: Number(sbTarget.wallet_balance) || 0
          };
          targetBal = Number(sbTarget.wallet_balance) || 0;
        }
      } catch (e) {}
    }

    if (!targetUser) {
      return res.status(404).json({ success: false, error: `Recipient "${recipient}" not found on Smart Hub` });
    }

    const newSenderBal = senderBal - numAmount;
    const newTargetBal = targetBal + numAmount;

    // Update sender & recipient in Supabase
    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase
          .from('users')
          .update({ wallet_balance: newSenderBal })
          .or(`id.eq.${sender.id},email.eq.${sender.email}`);

        await supabase
          .from('users')
          .update({ wallet_balance: newTargetBal })
          .or(`id.eq.${targetUser.id},email.eq.${targetUser.email}`);

        // Insert debit tx for sender
        await supabase.from('transactions').insert([{
          id: 't_out_' + Date.now(),
          user_id: sender.id,
          type: 'debit',
          title: `Transfer to ${targetUser.name}`,
          amount: numAmount,
          date: new Date().toISOString().split('T')[0],
          status: 'completed',
          reference_id: 'Peer Transfer',
          created_at: new Date().toISOString()
        }]);

        // Insert credit tx for recipient
        await supabase.from('transactions').insert([{
          id: 't_in_' + Date.now(),
          user_id: targetUser.id,
          type: 'credit',
          title: `Transfer from ${sender.name}`,
          amount: numAmount,
          date: new Date().toISOString().split('T')[0],
          status: 'completed',
          reference_id: 'Peer Transfer',
          created_at: new Date().toISOString()
        }]);
      } catch (sbErr) {
        console.warn('[Wallet Transfer] Supabase error:', sbErr.message);
      }
    }

    sender.walletBalance = newSenderBal;
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

    db.update('users', targetUser.id, { walletBalance: newTargetBal });
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
router.post('/withdraw', authOptional, async (req, res) => {
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

    // Fetch user's live balance from Supabase
    let currentBal = Number(user.walletBalance) || 0;
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data: sbUser } = await supabase
          .from('users')
          .select('wallet_balance')
          .or(`id.eq.${user.id},email.eq.${user.email}`)
          .maybeSingle();

        if (sbUser && sbUser.wallet_balance !== null && sbUser.wallet_balance !== undefined) {
          currentBal = Number(sbUser.wallet_balance) || 0;
        }
      } catch (e) {}
    }

    if (currentBal < numAmount) {
      return res.status(400).json({ success: false, error: 'Insufficient wallet balance' });
    }

    const newBal = currentBal - numAmount;

    // Update in Supabase
    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase
          .from('users')
          .update({ wallet_balance: newBal, upi_id: upiId || undefined })
          .or(`id.eq.${user.id},email.eq.${user.email}`);

        await supabase.from('transactions').insert([{
          id: 't_w_' + Date.now(),
          user_id: user.id,
          type: 'debit',
          title: 'Bank/UPI Withdrawal',
          amount: numAmount,
          date: new Date().toISOString().split('T')[0],
          status: 'completed',
          reference_id: upiId ? `UPI (${upiId})` : 'IMPS Bank Transfer',
          created_at: new Date().toISOString()
        }]);
      } catch (sbErr) {
        console.warn('[Wallet Withdraw] Supabase error:', sbErr.message);
      }
    }

    user.walletBalance = newBal;
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
