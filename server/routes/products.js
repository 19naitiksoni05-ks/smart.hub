const express = require('express');
const router = express.Router();
const db = require('../db');
const { authRequired, authOptional } = require('../middleware/auth');

// ── List Products with Filtering & Sorting ────────────────────
router.get('/', (req, res) => {
  try {
    let products = [...db.get('products')];
    const { cat, search, minPrice, maxPrice, sort, tag, limit } = req.query;

    // Filter by Category
    if (cat && cat !== 'all') {
      products = products.filter(p => p.category.toLowerCase() === cat.toLowerCase());
    }

    // Filter by Tag
    if (tag) {
      products = products.filter(p => p.tags && p.tags.some(t => t.toLowerCase() === tag.toLowerCase()));
    }

    // Search query
    if (search) {
      const q = search.toLowerCase();
      products = products.filter(p =>
        p.title.toLowerCase().includes(q) ||
        (p.description && p.description.toLowerCase().includes(q)) ||
        (p.tags && p.tags.some(t => t.toLowerCase().includes(q))) ||
        (p.author && p.author.name.toLowerCase().includes(q))
      );
    }

    // Price Filtering
    if (minPrice) {
      products = products.filter(p => p.price >= Number(minPrice));
    }
    if (maxPrice) {
      products = products.filter(p => p.price <= Number(maxPrice));
    }

    // Sorting
    if (sort === 'latest') {
      products.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    } else if (sort === 'price-low') {
      products.sort((a, b) => a.price - b.price);
    } else if (sort === 'price-high') {
      products.sort((a, b) => b.price - a.price);
    } else if (sort === 'rating') {
      products.sort((a, b) => b.rating - a.rating);
    } else {
      // Default: sort by sales (popular)
      products.sort((a, b) => (b.sales || 0) - (a.sales || 0));
    }

    if (limit) {
      products = products.slice(0, parseInt(limit));
    }

    res.json({
      success: true,
      count: products.length,
      products
    });
  } catch (err) {
    console.error('Products fetch error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch products' });
  }
});

// ── Get Product Categories ────────────────────────────────────
router.get('/categories', (req, res) => {
  try {
    const categories = db.get('categories') || [];
    res.json({ success: true, count: categories.length, categories });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch categories' });
  }
});

// ── Get Featured Products ─────────────────────────────────────
router.get('/featured', (req, res) => {
  try {
    const products = db.get('products') || [];
    const featured = products.slice(0, 8);
    res.json({ success: true, count: featured.length, products: featured });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch featured products' });
  }
});

// ── Get Single Product Details ────────────────────────────────
router.get('/:id', (req, res) => {
  try {
    const product = db.findById('products', req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    // Fetch associated reviews
    const reviews = db.find('reviews', r => r.productId === product.id || r.product === product.title);

    // Fetch related products (same category)
    const related = db.find('products', p => p.category === product.category && p.id !== product.id).slice(0, 4);

    res.json({
      success: true,
      product,
      reviews,
      related
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to retrieve product details' });
  }
});

// ── Create New Product (Seller Studio) ────────────────────────
router.post('/', authOptional, (req, res) => {
  try {
    const { title, category, price, oldPrice, description, tags, thumb, type, badge, videoUrl, downloadUrl, bundleInfo } = req.body;

    if (!title || !category || price === undefined || price === null || isNaN(Number(price))) {
      return res.status(400).json({ success: false, error: 'Title, category and a valid price (>= 0) are required' });
    }

    // Determine author
    let author = {
      id: 'dev_guest',
      name: 'Verified Developer',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=dev&backgroundColor=6366f1'
    };

    if (req.user) {
      author = {
        id: req.user.id,
        name: req.user.name,
        avatar: req.user.avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=user&backgroundColor=6366f1'
      };
    } else if (req.headers['x-user-id']) {
      const u = db.findById('users', req.headers['x-user-id']);
      if (u) {
        author = { id: u.id, name: u.name, avatar: u.avatar };
      }
    }

    const newProduct = {
      id: 'p_' + Date.now(),
      title: title.trim(),
      category,
      price: Math.max(0, Number(price)),
      oldPrice: oldPrice ? Number(oldPrice) : null,
      rating: 5.0,
      reviews: 1,
      sales: 0,
      author,
      tags: Array.isArray(tags) ? tags : (typeof tags === 'string' ? tags.split(',').map(t => t.trim()) : ['Code']),
      badge: badge || 'New',
      thumb: thumb || `https://picsum.photos/seed/${encodeURIComponent(title)}/400/250`,
      videoUrl: videoUrl || null,
      downloadUrl: downloadUrl || null,
      bundleInfo: bundleInfo || null,
      description: description || 'High performance digital source code asset.',
      type: type || 'Source Code',
      createdAt: new Date().toISOString()
    };

    db.insert('products', newProduct);

    // Also update categories count
    const categories = db.get('categories');
    const catItem = categories.find(c => c.name.toLowerCase() === category.toLowerCase());
    if (catItem) {
      catItem.count = (catItem.count || 0) + 1;
      db.save();
    }

    res.status(201).json({
      success: true,
      message: 'Product listed successfully on Smart Hub marketplace! 🚀',
      product: newProduct
    });
  } catch (err) {
    console.error('Create product error:', err);
    res.status(500).json({ success: false, error: 'Failed to list product' });
  }
});

// ── Update Product ────────────────────────────────────────────
router.put('/:id', authRequired, (req, res) => {
  try {
    const product = db.findById('products', req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    // Check ownership or allow admin
    if (product.author && product.author.id && product.author.id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Not authorized to edit this product' });
    }

    const updated = db.update('products', req.params.id, req.body);
    res.json({
      success: true,
      message: 'Product updated successfully',
      product: updated
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update product' });
  }
});

// ── Delete Product ────────────────────────────────────────────
router.delete('/:id', authRequired, (req, res) => {
  try {
    const success = db.delete('products', req.params.id);
    if (!success) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }
    res.json({ success: true, message: 'Product removed from marketplace' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to delete product' });
  }
});

// ── Add Product Review ────────────────────────────────────────
router.post('/:id/reviews', authOptional, (req, res) => {
  try {
    const product = db.findById('products', req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    const { rating, text } = req.body;
    if (!rating || !text) {
      return res.status(400).json({ success: false, error: 'Rating and review text are required' });
    }

    const user = req.user || { name: 'Verified Buyer', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=buyer&backgroundColor=6366f1' };

    const newReview = {
      id: 'r_' + Date.now(),
      productId: product.id,
      product: product.title,
      user: user.name,
      avatar: user.avatar,
      rating: Number(rating),
      text,
      location: user.location || 'India',
      date: new Date().toISOString().split('T')[0]
    };

    db.insert('reviews', newReview);

    // Update product rating & review count
    const allProdReviews = db.find('reviews', r => r.productId === product.id);
    const avgRating = allProdReviews.reduce((sum, r) => sum + r.rating, 0) / allProdReviews.length;
    db.update('products', product.id, {
      rating: Number(avgRating.toFixed(1)),
      reviews: allProdReviews.length
    });

    res.status(201).json({
      success: true,
      message: 'Review posted successfully!',
      review: newReview
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to submit review' });
  }
});

module.exports = router;
