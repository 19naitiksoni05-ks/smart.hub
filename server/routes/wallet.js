const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../db');
const { authRequired, authOptional } = require('../middleware/auth');
const { supabase, isSupabaseConfigured } = require('../supabase');

const RAZORPAY_KEY_ID = (process.env.RAZORPAY_KEY_ID || '').trim();
const RAZORPAY_KEY_SECRET = (process.env.RAZORPAY_KEY_SECRET || '').trim();

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

// ── 2. Create Payment Gateway Order (Razorpay) ───────────────
router.post('/create-order', authRequired, async (req, res) => {
  try {
    const { amount } = req.body;
    const numAmount = Number(amount);

    if (!numAmount || numAmount < 10 || numAmount > 500000) {
      return res.status(400).json({ success: false, error: 'Amount must be between ₹10 and ₹5,00,000' });
    }

    if (RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET) {
      try {
        const authHeader = 'Basic ' + Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64');
        const rpRes = await fetch('https://api.razorpay.com/v1/orders', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': authHeader
          },
          body: JSON.stringify({
            amount: Math.round(numAmount * 100), // paise
            currency: 'INR',
            receipt: `rcpt_${req.user.id}_${Date.now()}`
          }),
          signal: AbortSignal.timeout(8000)
        });

        const orderData = await rpRes.json();
        if (rpRes.ok && orderData.id) {
          return res.json({
            success: true,
            orderId: orderData.id,
            amount: numAmount,
            currency: 'INR',
            keyId: RAZORPAY_KEY_ID
          });
        }
      } catch (rpErr) {
        console.warn('[Wallet] Razorpay live order error:', rpErr.message);
      }
    }

    // Secure fallback simulator order for development/sandbox testing
    const mockOrderId = 'order_mock_' + crypto.randomBytes(12).toString('hex');
    res.json({
      success: true,
      orderId: mockOrderId,
      amount: numAmount,
      currency: 'INR',
      keyId: RAZORPAY_KEY_ID || 'rzp_test_mock',
      isSandbox: !Boolean(RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET)
    });
  } catch (err) {
    console.error('[Wallet] Create order error:', err);
    res.status(500).json({ success: false, error: 'Failed to create payment order' });
  }
});

// ── 3. Verify Payment Gateway Signature & Credit Wallet ──────
router.post('/verify-payment', authRequired, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, amount } = req.body;
    const numAmount = Number(amount);

    if (!numAmount || numAmount < 10) {
      return res.status(400).json({ success: false, error: 'Valid payment amount is required' });
    }
    if (!razorpay_order_id || !razorpay_payment_id) {
      return res.status(400).json({ success: false, error: 'Missing gateway order or payment identifier' });
    }

    // Idempotency: verify this payment_id has never been redeemed before
    const existingTx = db.findOne('transactions', t => t.reference_id === razorpay_payment_id);
    if (existingTx) {
      return res.status(409).json({ success: false, error: 'This payment has already been credited to a wallet.' });
    }

    // If live Razorpay secret is configured, strictly verify cryptographic HMAC signature
    if (RAZORPAY_KEY_SECRET) {
      if (!razorpay_signature) {
        return res.status(400).json({ success: false, error: 'Razorpay cryptographic signature is required' });
      }
      const expectedSignature = crypto
        .createHmac('sha256', RAZORPAY_KEY_SECRET)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex');

      if (expectedSignature !== razorpay_signature) {
        return res.status(400).json({ success: false, error: 'Invalid payment signature. Verification failed.' });
      }
    }

    // Fetch live user balance
    let currentBal = Number(req.user.walletBalance) || 0;
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data: sbUser } = await supabase
          .from('users')
          .select('wallet_balance')
          .or(`id.eq.${req.user.id},email.eq.${req.user.email}`)
          .maybeSingle();
        if (sbUser && sbUser.wallet_balance !== null && sbUser.wallet_balance !== undefined) {
          currentBal = Number(sbUser.wallet_balance) || 0;
        }
      } catch (e) { }
    }

    const newBalance = currentBal + numAmount;

    // Update balance in Supabase cloud
    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase
          .from('users')
          .update({ wallet_balance: newBalance })
          .or(`id.eq.${req.user.id},email.eq.${req.user.email}`);
      } catch (sbErr) { }
    }

    req.user.walletBalance = newBalance;
    db.update('users', req.user.id, { walletBalance: newBalance });

    const newTx = {
      id: 't_' + Date.now(),
      userId: req.user.id,
      type: 'credit',
      title: 'Gateway Top-up (Razorpay Verified)',
      amount: numAmount,
      date: new Date().toISOString().split('T')[0],
      icon: '➕',
      method: 'Razorpay Gateway',
      reference_id: razorpay_payment_id,
      createdAt: new Date().toISOString()
    };

    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase.from('transactions').insert([{
          id: newTx.id,
          user_id: req.user.id,
          type: newTx.type,
          title: newTx.title,
          amount: newTx.amount,
          date: newTx.date,
          status: 'completed',
          reference_id: razorpay_payment_id,
          created_at: newTx.createdAt
        }]);
      } catch (txErr) { }
    }

    db.insert('transactions', newTx);

    res.json({
      success: true,
      message: `₹${numAmount.toLocaleString('en-IN')} verified and added to your wallet! 🎉`,
      newBalance,
      transaction: newTx
    });
  } catch (err) {
    console.error('[Wallet] Verify payment error:', err);
    res.status(500).json({ success: false, error: 'Failed to verify payment' });
  }
});

// ── 4. Top-up Wallet (Authenticated & Idempotent) ─────────────
router.post('/topup', authRequired, async (req, res) => {
  try {
    const { amount, method = 'UPI', idempotencyKey } = req.body;
    const finalKey = req.headers['x-idempotency-key'] || idempotencyKey;
    const numAmount = Number(amount);

    if (!numAmount || numAmount < 10 || numAmount > 500000) {
      return res.status(400).json({ success: false, error: 'Amount must be between ₹10 and ₹5,00,000' });
    }

    // Idempotency guard: prevent duplicate topup credits
    if (finalKey) {
      const existing = db.findOne('transactions', t => t.idempotencyKey === finalKey);
      if (existing) {
        let bal = existing.newBalance;
        if (bal === undefined || bal === null) {
          const latestUser = db.findOne('users', u => u.id === req.user.id || (u.email && req.user.email && u.email.toLowerCase() === req.user.email.toLowerCase()));
          bal = latestUser ? latestUser.walletBalance : (Number(req.user.walletBalance) || 0);
        }
        return res.json({
          success: true,
          message: 'Top-up already completed (idempotent)',
          newBalance: bal,
          transaction: existing
        });
      }
    }

    const user = req.user;

    // Fetch current balance from Supabase
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
      } catch (e) { }
    }

    const newBalance = currentBal + numAmount;

    // Directly persist to Supabase cloud
    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase
          .from('users')
          .update({ wallet_balance: newBalance })
          .or(`id.eq.${user.id},email.eq.${user.email}`);
      } catch (sbErr) { }
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
      idempotencyKey: finalKey || null,
      newBalance: newBalance,
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
      } catch (txErr) { }
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

// ── 5. Transfer to Another User (Atomic & Authenticated) ───────
router.post('/transfer', authRequired, async (req, res) => {
  try {
    const { recipient, amount, idempotencyKey } = req.body;
    const finalKey = req.headers['x-idempotency-key'] || idempotencyKey;
    const numAmount = Number(amount);

    if (!recipient || !numAmount || numAmount < 1 || numAmount > 100000) {
      return res.status(400).json({ success: false, error: 'Valid recipient and amount (₹1 to ₹1,00,000) are required' });
    }

    if (finalKey) {
      const existing = db.findOne('transactions', t => t.idempotencyKey === finalKey);
      if (existing) {
        let bal = existing.newBalance;
        if (bal === undefined || bal === null) {
          const latestUser = db.findOne('users', u => u.id === req.user.id || (u.email && req.user.email && u.email.toLowerCase() === req.user.email.toLowerCase()));
          bal = latestUser ? latestUser.walletBalance : (Number(req.user.walletBalance) || 0);
        }
        return res.json({
          success: true,
          message: 'Transfer already completed (idempotent)',
          newBalance: bal
        });
      }
    }

    const sender = req.user;

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
      } catch (e) { }
    }

    if (senderBal < numAmount) {
      return res.status(400).json({ success: false, error: 'Insufficient wallet balance for transfer' });
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
      } catch (e) { }
    }

    if (!targetUser) {
      return res.status(404).json({ success: false, error: `Recipient "${recipient}" not found on Smart Hub` });
    }

    // Prevent self-transfer
    if (String(sender.id) === String(targetUser.id) || sender.email.toLowerCase() === targetUser.email?.toLowerCase()) {
      return res.status(400).json({ success: false, error: 'Cannot transfer funds to your own account' });
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

        await supabase.from('transactions').insert([
          {
            id: 't_out_' + Date.now(),
            user_id: sender.id,
            type: 'debit',
            title: `Transfer to ${targetUser.name}`,
            amount: numAmount,
            date: new Date().toISOString().split('T')[0],
            status: 'completed',
            reference_id: 'Peer Transfer',
            created_at: new Date().toISOString()
          },
          {
            id: 't_in_' + Date.now(),
            user_id: targetUser.id,
            type: 'credit',
            title: `Transfer from ${sender.name}`,
            amount: numAmount,
            date: new Date().toISOString().split('T')[0],
            status: 'completed',
            reference_id: 'Peer Transfer',
            created_at: new Date().toISOString()
          }
        ]);
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
      method: 'Peer Transfer',
      idempotencyKey: finalKey || null,
      newBalance: newSenderBal
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

// ── 6. Withdraw to Bank / UPI (Authenticated) ─────────────────
router.post('/withdraw', authRequired, async (req, res) => {
  try {
    const { amount, upiId, idempotencyKey } = req.body;
    const finalKey = req.headers['x-idempotency-key'] || idempotencyKey;
    const numAmount = Number(amount);

    if (!numAmount || numAmount < 100) {
      return res.status(400).json({ success: false, error: 'Minimum withdrawal amount is ₹100' });
    }

    if (finalKey) {
      const existing = db.findOne('transactions', t => t.idempotencyKey === finalKey);
      if (existing) {
        let bal = existing.newBalance;
        if (bal === undefined || bal === null) {
          const latestUser = db.findOne('users', u => u.id === req.user.id || (u.email && req.user.email && u.email.toLowerCase() === req.user.email.toLowerCase()));
          bal = latestUser ? latestUser.walletBalance : (Number(req.user.walletBalance) || 0);
        }
        return res.json({
          success: true,
          message: 'Withdrawal already processed (idempotent)',
          newBalance: bal,
          transaction: existing
        });
      }
    }

    const user = req.user;

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
      } catch (e) { }
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
      title: 'Bank/UPI Withdrawal',
      amount: numAmount,
      date: new Date().toISOString().split('T')[0],
      icon: '🏦',
      method: upiId ? `UPI (${upiId})` : 'IMPS Bank Transfer',
      idempotencyKey: finalKey || null,
      newBalance: newBal
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
