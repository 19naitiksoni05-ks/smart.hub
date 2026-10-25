const express = require('express');
const router = express.Router();
const db = require('../db');
const { authOptional } = require('../middleware/auth');

// ── Creator Studio KPIs & Listing Table ───────────────────────
function getSellerStatsHandler(req, res) {
  try {
    const user = req.user || null;
    const products = db.get('products') || [];
    const myProducts = user
      ? products.filter(p => p.author && (p.author.id === user.id || p.author.name === user.name))
      : [];

    const totalSales = myProducts.reduce((sum, p) => sum + (p.sales || 0), 0);
    const lifetimeEarnings = myProducts.reduce((sum, p) => sum + ((p.sales || 0) * p.price), 0);
    const avgRating = myProducts.length > 0
      ? (myProducts.reduce((sum, p) => sum + (p.rating || 5), 0) / myProducts.length).toFixed(2)
      : '5.0';

    const formattedListings = myProducts.map(p => ({
      id: p.id,
      title: p.title,
      category: p.category,
      price: p.price,
      sales: p.sales || 0,
      earnings: (p.sales || 0) * p.price,
      rating: p.rating || 5,
      status: 'Active',
      licenseType: 'Dynamic AES-256 Escrow'
    }));

    res.json({
      success: true,
      earnings: lifetimeEarnings,
      sales: totalSales,
      activeListings: myProducts.length,
      rating: avgRating,
      stats: {
        lifetimeEarnings,
        totalSales,
        activeListings: myProducts.length,
        rating: avgRating,
        royaltyRate: 'Up to 99.5%',
        platformFee: '0.5% - 3% (Only on sales)'
      },
      listings: formattedListings,
      products: myProducts
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch seller analytics' });
  }
}

router.get(['/stats', '/analytics', '/overview', '/'], authOptional, getSellerStatsHandler);

// ── Seller Products List ──────────────────────────────────────
router.get(['/products', '/listings'], authOptional, (req, res) => {
  try {
    const user = req.user || null;
    const products = db.get('products') || [];
    const myProducts = user
      ? products.filter(p => p.author && (p.author.id === user.id || p.author.name === user.name))
      : [];

    res.json({
      success: true,
      count: myProducts.length,
      products: myProducts,
      listings: myProducts
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch seller products' });
  }
});

module.exports = router;
