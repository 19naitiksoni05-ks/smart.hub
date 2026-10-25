const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const { WebSocketServer, WebSocket } = require('ws');
require('dotenv').config();

const db = require('./db');

// Route modules
const authRoutes = require('./routes/auth');
const productsRoutes = require('./routes/products');
const ordersRoutes = require('./routes/orders');
const walletRoutes = require('./routes/wallet');
const feedRoutes = require('./routes/feed');
const chatRoutes = require('./routes/chat');
const communityRoutes = require('./routes/community');
const challengesRoutes = require('./routes/challenges');
const sellerRoutes = require('./routes/seller');
const adminRoutes = require('./routes/admin');

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request Logger
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (req.url.startsWith('/api')) {
      console.log(`[API] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${duration}ms)`);
    }
  });
  next();
});

// ── WebSocket Server Setup ───────────────────────────────────
const wss = new WebSocketServer({ server });
const connectedClients = new Set();

wss.on('connection', (ws, req) => {
  connectedClients.add(ws);
  console.log(`[WS] Client connected. Active clients: ${connectedClients.size}`);

  ws.send(JSON.stringify({
    type: 'CONNECTED',
    message: 'Connected to Smart Hub real-time gateway',
    timestamp: new Date().toISOString()
  }));

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      // Broadcast to other clients
      broadcastWs(data, ws);
    } catch (err) {
      console.error('[WS] Message error:', err);
    }
  });

  ws.on('close', () => {
    connectedClients.delete(ws);
    console.log(`[WS] Client disconnected. Active clients: ${connectedClients.size}`);
  });
});

function broadcastWs(payload, senderWs = null) {
  const messageStr = JSON.stringify(payload);
  connectedClients.forEach(client => {
    if (client !== senderWs && client.readyState === WebSocket.OPEN) {
      client.send(messageStr);
    }
  });
}

// Make broadcaster accessible in route handlers
app.set('broadcastWs', broadcastWs);

// ── Mount API Routes ─────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/feed', feedRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/community', communityRoutes);
app.use('/api/challenges', challengesRoutes);
app.use('/api/seller', sellerRoutes);
app.use('/api/admin', adminRoutes);

// Categories endpoint
app.get('/api/categories', (req, res) => {
  res.json({ success: true, categories: db.get('categories') });
});

// Full Bootstrap Data (for instant 1-shot page hydration)
app.get('/api/bootstrap', (req, res) => {
  try {
    const products = db.get('products');
    const categories = db.get('categories');
    const reviews = db.get('reviews');
    const leaderboard = db.get('leaderboard');
    const challenges = db.get('challenges');
    const transactions = db.get('transactions');
    const user = null;

    res.json({
      success: true,
      currentUser: user,
      products,
      categories,
      reviews,
      leaderboard,
      challenges,
      transactions
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to bootstrap data' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ONLINE',
    service: 'Smart Hub Backend Server',
    version: '1.0.0',
    port: PORT,
    uptime: `${Math.floor(process.uptime())}s`,
    database: {
      products: db.get('products').length,
      users: db.get('users').length,
      orders: db.get('orders').length,
      transactions: db.get('transactions').length
    },
    timestamp: new Date().toISOString()
  });
});

// Live platform stats & verified sales
app.get('/api/stats', (req, res) => {
  try {
    const orders = db.get('orders') || [];
    const users = db.get('users') || [];
    const products = db.get('products') || [];
    const transactions = db.get('transactions') || [];

    // Real total sales
    const totalSales = orders.reduce((sum, o) => sum + (Number(o.amount) || 0), 0);

    // Today's sales (YYYY-MM-DD)
    const todayStr = new Date().toISOString().split('T')[0];
    const todayOrders = orders.filter(o => o.createdAt && o.createdAt.startsWith(todayStr));
    const todaySales = todayOrders.reduce((sum, o) => sum + (Number(o.amount) || 0), 0);

    // Latest real sale
    const latestSale = orders.length > 0 ? {
      orderNumber: orders[orders.length - 1].orderNumber,
      productTitle: orders[orders.length - 1].productTitle,
      amount: orders[orders.length - 1].amount,
      createdAt: orders[orders.length - 1].createdAt
    } : null;

    res.json({
      success: true,
      totalSales,
      todaySales,
      ordersCount: orders.length,
      todayOrdersCount: todayOrders.length,
      usersCount: users.length,
      activeUsers: Math.max(users.length, connectedClients.size),
      productsCount: products.length,
      transactionsCount: transactions.length,
      latestSale,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Static Frontend Serving ───────────────────────────────────
const FRONTEND_ROOT = path.join(__dirname, '..');
app.use(express.static(FRONTEND_ROOT));

// Fallback for HTML routing (Express 5 compatible)
app.use((req, res, next) => {
  if (req.url.startsWith('/api')) {
    return res.status(404).json({ success: false, error: 'Endpoint not found' });
  }
  const file = path.join(FRONTEND_ROOT, req.url);
  if (req.url.endsWith('.html') && path.extname(req.url)) {
    return res.sendFile(file);
  }
  res.sendFile(path.join(FRONTEND_ROOT, 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('[Server Error]', err);
  res.status(500).json({
    success: false,
    error: err.message || 'Internal Server Error'
  });
});

// Start Server
server.listen(PORT, () => {
  console.log(`
═════════════════════════════════════════════════════════════════
  🚀 SMART HUB PRODUCTION SERVER ACTIVE & READY FOR DEPLOYMENT
  ✦ Local URL:       http://localhost:${PORT}
  ✦ API Base:        http://localhost:${PORT}/api
  ✦ Health:          http://localhost:${PORT}/api/health
  ✦ Real-time WS:    ws://localhost:${PORT}
═════════════════════════════════════════════════════════════════
  ✦ Clean State: All demo/fake products & accounts cleared.
  ✦ Ready for fresh user registration and creator listings.
═════════════════════════════════════════════════════════════════
  `);
});
