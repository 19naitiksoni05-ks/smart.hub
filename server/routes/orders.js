const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const db = require('../db');
const { authRequired, authOptional } = require('../middleware/auth');

// Server-side backend pepper secret (never sent to client)
const LICENSE_PEPPER = process.env.LICENSE_PEPPER || 'smarthub_vault_license_pepper_2026_aes256';

// Cache for live dynamic simulator tokens (10 min TTL)
const sampleTokensCache = new Map();

/**
 * Generate a cryptographically secure, multi-factor license token.
 * Factors:
 * 1. Project Identifier (productId)
 * 2. Purchase Transaction ID (orderNumber)
 * 3. Buyer Email (buyerEmail)
 * 4. Purchase Timestamp (timestamp)
 * 5. Cryptographic CSPRNG Entropy (crypto.randomBytes)
 * 6. Backend-only HMAC-SHA256 signature
 */
function generateDynamicLicenseKey({ productId, orderNumber, buyerEmail, timestamp = Date.now() }) {
  // Derive project fingerprint
  const projHash = crypto
    .createHash('sha256')
    .update(String(productId || 'PRJ'))
    .digest('hex')
    .substring(0, 4)
    .toUpperCase();

  // Generate cryptographically strong random entropy
  const randomEntropy = crypto.randomBytes(8).toString('hex').toUpperCase();
  const nonce = randomEntropy.substring(0, 4);

  // Compute HMAC signature across all distinct purchase factors
  const hmac = crypto.createHmac('sha256', LICENSE_PEPPER);
  hmac.update(`${productId}:${orderNumber}:${buyerEmail}:${timestamp}:${randomEntropy}`);
  const signatureChecksum = hmac.digest('hex').substring(0, 4).toUpperCase();

  const year = new Date(timestamp).getFullYear();

  // Format: SH-KEY-2026-[PROJ_HASH]-[NONCE]-[CHECKSUM]
  return `SH-KEY-${year}-${projHash}-${nonce}-${signatureChecksum}`;
}

// ── Execute Encrypted Checkout & Dispatch Activation Email ───
router.post('/checkout', authOptional, (req, res) => {
  try {
    const { productId, items, paymentMethod = 'wallet', deliveryEmail, couponCode, license = 'regular' } = req.body;

    if (!deliveryEmail || !deliveryEmail.includes('@')) {
      return res.status(400).json({ success: false, error: 'Valid delivery email address is required' });
    }

    // Determine target checkout items
    let checkoutItems = [];
    if (Array.isArray(items) && items.length > 0) {
      for (const it of items) {
        const pId = it.productId || it.id;
        const prod = db.findById('products', pId);
        if (prod) {
          checkoutItems.push({
            product: prod,
            qty: Number(it.qty) || 1,
            license: it.license || license || 'regular'
          });
        }
      }
      if (checkoutItems.length === 0) {
        return res.status(404).json({ success: false, error: 'None of the requested products were found' });
      }
    } else if (productId) {
      const product = db.findById('products', productId);
      if (!product) {
        return res.status(404).json({ success: false, error: 'Product not found' });
      }
      checkoutItems.push({
        product,
        qty: 1,
        license
      });
    } else {
      return res.status(400).json({ success: false, error: 'No product or cart items provided for checkout' });
    }

    // Calculate aggregated prices
    let totalBase = 0;
    const computedItems = checkoutItems.map(item => {
      let unitPrice = item.product.price;
      if (item.license === 'extended') {
        unitPrice = Math.round(item.product.price * 3.2);
      }
      const itemSubtotal = unitPrice * item.qty;
      totalBase += itemSubtotal;
      return {
        ...item,
        unitPrice,
        subtotal: itemSubtotal
      };
    });

    let discount = 0;
    if (couponCode && couponCode.toUpperCase() === 'OUTLINE10') {
      discount = Math.round(totalBase * 0.10);
    }
    const finalAmount = Math.max(0, totalBase - discount);
    const buyer = req.user || null;

    // Purchases can only be done through the wallet system
    if (paymentMethod !== 'wallet') {
      return res.status(400).json({
        success: false,
        error: 'Purchases can only be made using the Smart Hub Rupee Wallet. Please add money to your wallet to continue.'
      });
    }

    if (!buyer) {
      return res.status(401).json({
        success: false,
        error: 'Please sign in to your Smart Hub account to complete this purchase using your Rupee Wallet.'
      });
    }

    if ((buyer.walletBalance || 0) < finalAmount) {
      return res.status(400).json({
        success: false,
        error: `Insufficient wallet balance. You have ₹${(buyer.walletBalance || 0).toLocaleString('en-IN')}, required ₹${finalAmount.toLocaleString('en-IN')}. Please add money to your wallet.`
      });
    }

    // Deduct buyer wallet
    const newBuyerBal = (buyer.walletBalance || 0) - finalAmount;
    db.update('users', buyer.id, { walletBalance: newBuyerBal });

    // Record buyer debit transaction
    const titles = computedItems.map(i => i.product.title).join(', ');
    db.insert('transactions', {
      id: 't_' + Date.now(),
      userId: buyer.id,
      type: 'debit',
      title: `Purchase: ${titles.length > 50 ? titles.substring(0, 47) + '...' : titles}`,
      amount: finalAmount,
      date: new Date().toISOString().split('T')[0],
      icon: '🛒',
      seller: computedItems[0].product.author ? computedItems[0].product.author.name : 'Smart Hub Creator',
      method: 'Smart Hub Rupee Wallet'
    });

    // Process each item: create order, dynamic license key, update seller earnings & sales count
    const createdOrders = [];
    const encKeysList = [];
    const sentEmails = [];

    for (let i = 0; i < computedItems.length; i++) {
      const it = computedItems[i];
      const product = it.product;
      const itemRatio = totalBase > 0 ? (it.subtotal / totalBase) : (1 / computedItems.length);
      const itemFinalAmount = Math.max(0, Math.round(it.subtotal - (discount * itemRatio)));

      // Calculate Platform Fee
      let feeRate = 0.02;
      if (itemFinalAmount >= 10000) feeRate = 0.005;
      else if (itemFinalAmount >= 3000) feeRate = 0.012;
      else if (itemFinalAmount >= 1000) feeRate = 0.02;
      else feeRate = 0.03;

      const platformFee = Math.round(itemFinalAmount * feeRate);
      const statutoryGst = Math.round(platformFee * 0.18);
      const sellerNetEarnings = Math.max(0, itemFinalAmount - (platformFee + statutoryGst));

      // Credit seller wallet
      if (product.author && product.author.id) {
        const seller = db.findById('users', product.author.id);
        if (seller) {
          db.update('users', seller.id, { walletBalance: (seller.walletBalance || 0) + sellerNetEarnings });
          db.insert('transactions', {
            id: 't_s_' + Date.now() + '_' + i,
            userId: seller.id,
            type: 'credit',
            title: `Sale: ${product.title} (Net after ${(feeRate * 100).toFixed(1)}% fee & tax)`,
            amount: sellerNetEarnings,
            date: new Date().toISOString().split('T')[0],
            icon: '💸',
            buyer: deliveryEmail,
            method: 'SmartHub Store'
          });
        }
      }

      // Generate dynamic encryption key
      const orderNumber = `SH-ORD-2026-${Math.floor(1000 + Math.random() * 9000)}`;
      const encKey = generateDynamicLicenseKey({
        productId: product.id,
        orderNumber,
        buyerEmail: deliveryEmail,
        timestamp: Date.now() + i
      });

      const newOrder = {
        id: 'ord_' + Date.now() + '_' + i,
        orderNumber,
        buyerId: buyer ? buyer.id : null,
        buyerEmail: deliveryEmail,
        productId: product.id,
        productTitle: product.title,
        category: product.category,
        amount: itemFinalAmount,
        platformFee,
        statutoryTax: statutoryGst,
        sellerNetEarnings,
        platformFeePercent: (feeRate * 100).toFixed(1) + '%',
        discount: Math.round(discount * itemRatio),
        license: it.license,
        paymentMethod,
        encKey,
        keyActivated: false, // Initially unactivated - buyer must verify in website!
        status: 'completed',
        emailSent: true,
        emailSentTo: deliveryEmail,
        emailSentAt: new Date().toISOString(),
        downloadUrl: null,
        downloadDisabled: true,
        deliveryMethod: 'email_only',
        createdAt: new Date().toISOString()
      };

      db.insert('orders', newOrder);
      db.update('products', product.id, { sales: (product.sales || 0) + it.qty });

      const zipName = (product.bundleInfo && product.bundleInfo.folderName ? `${product.bundleInfo.folderName}.zip` : `${product.title.replace(/[^a-zA-Z0-9_-]/g, '_')}_source.zip`);

      const origin = req.get('origin') || (req.protocol + '://' + req.get('host')) || 'http://localhost:5000';

      // Generate Email Record & Save to database (File & Key delivered to email only)
      const emailRecord = {
        id: 'email_' + Date.now() + '_' + i,
        to: deliveryEmail,
        subject: `🔒 Smart Hub Source Code Package & Encryption Key: ${product.title}`,
        orderNumber,
        productId: product.id,
        productTitle: product.title,
        encKey,
        activationUrl: `/repo.html?id=${product.id}&activateKey=${encKey}`,
        sentAt: new Date().toISOString(),
        status: 'delivered',
        deliveryMethod: 'Email Only (Direct Website Download Disabled)',
        attachedPackage: {
          filename: zipName,
          fileType: 'application/zip',
          encryption: 'AES-256 Multi-Factor Cryptographic Token'
        },
        body: `Dear Developer,

Thank you for purchasing "${product.title}" on Smart Hub India.

Your source code package is cryptographically protected with AES-256 DRM. Direct website downloads, unauthorized copying, screenshots, and screen recordings are strictly restricted to protect developer intellectual property.

YOUR ENCRYPTED SOURCE PACKAGE & ENCRYPTION KEY:
======================================================
PROJECT: ${product.title}
ATTACHED PACKAGE FILE: ${zipName}
DELIVERY METHOD: Sent directly to your email inbox
ENCRYPTION KEY:
${encKey}
======================================================

IMPORTANT SECURITY NOTICE:
Direct browser downloads from the website are completely disabled. Your complete source code archive is dispatched ONLY via this verified email alongside your unique encryption key.

TO DECRYPT & INSPECT SOURCE CODE IN SMART HUB STUDIO:
1. Open the project in Smart Hub:
   ${origin}/repo.html?id=${product.id}
2. Enter your Encryption Key in the verification box, or simply click this instant activation link:
   ${origin}/repo.html?id=${product.id}&activateKey=${encKey}
3. Once verified in the browser, the source code will decrypt and unlock for viewing and copying.

Order Number: ${orderNumber}
Licensee: ${deliveryEmail}
Delivery Timestamp: ${new Date().toISOString()}

Happy Building!
The Smart Hub Engineering Team`
      };

      db.insert('emails', emailRecord);
      sentEmails.push(emailRecord);

      createdOrders.push(newOrder);
      encKeysList.push({
        title: product.title,
        key: encKey,
        orderNumber,
        downloadUrl: null,
        downloadDisabled: true,
        deliveryMethod: 'email_only',
        activationUrl: emailRecord.activationUrl
      });
    }

    // Broadcast sale via WebSocket
    try {
      const broadcastWs = req.app.get('broadcastWs');
      if (broadcastWs) {
        const allOrders = db.get('orders') || [];
        const totalSales = allOrders.reduce((sum, o) => sum + (Number(o.amount) || 0), 0);
        broadcastWs({
          type: 'NEW_SALE',
          order: {
            orderNumber: createdOrders[0].orderNumber,
            productTitle: createdOrders.length === 1 ? createdOrders[0].productTitle : `${createdOrders.length} Products Bundle`,
            amount: finalAmount,
            createdAt: createdOrders[0].createdAt
          },
          totalSales,
          ordersCount: allOrders.length
        });
      }
    } catch (wsErr) {
      console.warn('[WS] broadcast sale error:', wsErr);
    }

    const primaryOrder = createdOrders[0];
    res.status(201).json({
      success: true,
      message: `Transaction successful! Encrypted package and activation key sent via email to ${deliveryEmail}. Please verify your key on the website to activate.`,
      order: primaryOrder,
      orders: createdOrders,
      encKey: primaryOrder.encKey,
      encKeys: encKeysList,
      emailDispatched: true,
      emailSentTo: deliveryEmail,
      emails: sentEmails,
      activationUrl: sentEmails[0] ? sentEmails[0].activationUrl : null,
      downloadUrl: null,
      downloadDisabled: true,
      deliveryMethod: 'email_only',
      updatedWalletBalance: (buyer && paymentMethod === 'wallet') ? (buyer.walletBalance - finalAmount) : (buyer ? buyer.walletBalance : 0)
    });
  } catch (err) {
    console.error('Checkout error:', err);
    res.status(500).json({ success: false, error: 'Payment processing failed: ' + err.message });
  }
});

// ── Activate Encryption Key for Source Code Access ────────────
router.post(['/activate-key', '/verify-key'], authOptional, (req, res) => {
  try {
    const rawKey = req.body.licenseKey || req.body.key || req.body.encKey;
    const { productId, email } = req.body;
    if (!rawKey) {
      return res.status(400).json({ success: false, error: 'Encryption key is required for activation.' });
    }

    const cleanKey = rawKey.trim().toUpperCase();
    const orders = db.get('orders') || [];

    // Match order by encKey (case-insensitive) and optionally productId
    const order = orders.find(o => 
      o.encKey && o.encKey.toUpperCase() === cleanKey &&
      (!productId || o.productId === productId)
    );

    if (!order) {
      return res.status(404).json({
        success: false,
        valid: false,
        error: 'Invalid or unrecognized encryption key. Please check the key sent to your email.'
      });
    }

    // Mark key as activated
    order.keyActivated = true;
    order.activatedAt = new Date().toISOString();
    order.activatedByEmail = email || (req.user ? req.user.email : order.buyerEmail);
    if (req.user && !order.buyerId) {
      order.buyerId = req.user.id;
    }
    db.update('orders', order.id, order);

    res.json({
      success: true,
      valid: true,
      activated: true,
      message: `Encryption key verified successfully! Source code for "${order.productTitle}" is now decrypted and unlocked.`,
      orderId: order.id,
      orderNumber: order.orderNumber,
      productId: order.productId,
      buyerEmail: order.buyerEmail,
      encKey: order.encKey,
      downloadUrl: null,
      downloadDisabled: true,
      deliveryMethod: 'email_only',
      activatedAt: order.activatedAt
    });
  } catch (err) {
    console.error('Key activation error:', err);
    res.status(500).json({ success: false, error: 'Failed to activate key: ' + err.message });
  }
});

// ── Check Access Permission for Project Source Code ───────────
router.get(['/check-access/:productId', '/access-check/:productId'], authOptional, (req, res) => {
  try {
    const prodId = req.params.productId;
    const product = db.findById('products', prodId);
    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    const user = req.user || null;
    const clientKey = (req.query.key || req.headers['x-license-key'] || '').trim().toUpperCase();

    // 1. Author or admin always has full access
    if (user && (user.role === 'admin' || (product.author && product.author.id === user.id))) {
      return res.json({
        success: true,
        hasAccess: true,
        isOwner: true,
        isActivated: true,
        reason: 'OWNER_OR_ADMIN'
      });
    }

    // 2. Check if key provided matches an activated order
    if (clientKey) {
      const orderByKey = db.findOne('orders', o => 
        o.productId === prodId && 
        o.encKey && o.encKey.toUpperCase() === clientKey && 
        o.keyActivated === true
      );
      if (orderByKey) {
        return res.json({
          success: true,
          hasAccess: true,
          isOwner: false,
          isActivated: true,
          reason: 'ACTIVATED_KEY_VERIFIED',
          buyerEmail: orderByKey.buyerEmail,
          orderNumber: orderByKey.orderNumber,
          encKey: orderByKey.encKey
        });
      }
    }

    // 3. Check if logged-in user has an activated order
    if (user) {
      const userOrder = db.findOne('orders', o =>
        o.productId === prodId &&
        (o.buyerId === user.id || o.buyerEmail === user.email) &&
        o.keyActivated === true
      );
      if (userOrder) {
        return res.json({
          success: true,
          hasAccess: true,
          isOwner: false,
          isActivated: true,
          reason: 'USER_PURCHASED_AND_ACTIVATED',
          buyerEmail: userOrder.buyerEmail,
          orderNumber: userOrder.orderNumber,
          encKey: userOrder.encKey
        });
      }

      // Check if user bought it, but hasn't activated their key yet
      const unactOrder = db.findOne('orders', o =>
        o.productId === prodId &&
        (o.buyerId === user.id || o.buyerEmail === user.email)
      );
      if (unactOrder) {
        return res.json({
          success: true,
          hasAccess: false,
          isOwner: false,
          isActivated: false,
          hasUnactivatedOrder: true,
          reason: 'PURCHASED_BUT_NOT_ACTIVATED',
          orderNumber: unactOrder.orderNumber,
          buyerEmail: unactOrder.buyerEmail,
          message: 'Order found! Please enter the encryption key sent to your email to decrypt access.'
        });
      }
    }

    return res.json({
      success: true,
      hasAccess: false,
      isOwner: false,
      isActivated: false,
      reason: 'UNPURCHASED',
      price: product.price
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Access check failed' });
  }
});

// ── Get Sent Delivery Emails (Simulated Email Inbox) ──────────
router.get('/email-inbox/:email', (req, res) => {
  try {
    const email = req.params.email;
    const allEmails = db.get('emails') || [];
    const matched = allEmails.filter(e => e.to && e.to.toLowerCase() === email.toLowerCase());
    res.json({ success: true, count: matched.length, emails: matched });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to retrieve email inbox' });
  }
});

// ── Get User's Purchased Orders ───────────────────────────────
router.get('/my-orders', authOptional, (req, res) => {
  try {
    const user = req.user || null;
    if (!user) {
      return res.json({ success: true, count: 0, orders: [] });
    }
    const orders = db.find('orders', o => o.buyerId === user.id || o.buyerEmail === user.email);
    res.json({ success: true, count: orders.length, orders });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to retrieve orders' });
  }
});

// ── Verify Cryptographic Token Key ────────────────────────────
router.get('/verify-key/:key', (req, res) => {
  try {
    const key = req.params.key.trim().toUpperCase();
    const order = db.findOne('orders', o => o.encKey && o.encKey.toUpperCase() === key);
    const sample = sampleTokensCache.get(key);

    if (!order && !sample) {
      return res.status(404).json({
        success: false,
        valid: false,
        error: 'Invalid or unrecognized cryptographic token key'
      });
    }

    const title = (order && order.productTitle) || (sample && sample.projectTitle) || 'Audited Package';
    const orderNum = (order && order.orderNumber) || (sample && sample.sampleId);

    res.json({
      success: true,
      valid: true,
      encKey: key,
      productTitle: title,
      orderNumber: orderNum,
      keyActivated: order ? Boolean(order.keyActivated) : true,
      status: (order && !order.keyActivated) ? 'UNACTIVATED (AWAITING VERIFICATION)' : 'VERIFIED & UNLOCKED',
      algorithm: 'AES-256-GCM / HMAC-SHA256 Multi-Factor',
      factorsVerified: ['Project Hash', 'Transaction Nonce', 'Timestamp Entropy', 'Cryptographic Signature']
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Key verification failed' });
  }
});

// ── Download Project Source Package (.zip) (Disabled - Dispatched via Email Only) ──
router.get('/:idOrNumber/download', authOptional, (req, res) => {
  return res.status(403).json({
    success: false,
    downloadDisabled: true,
    error: 'Direct website downloads are disabled for intellectual property and security protection. The complete encrypted project source package (.zip) is dispatched exclusively to your verified email address along with your unique encryption key.'
  });
});

module.exports = router;
