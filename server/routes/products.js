const express = require('express');
const router = express.Router();
const db = require('../db');
const { authRequired, authOptional } = require('../middleware/auth');
const { supabase, isConfigured } = require('../supabase');

// Helper to format Supabase product row into platform model
function formatSupabaseProduct(p) {
  return {
    id: p.id,
    title: p.title,
    description: p.description,
    price: Number(p.price) || 0,
    oldPrice: p.original_price ? Number(p.original_price) : null,
    discount: p.discount || 0,
    category: p.category,
    badge: p.badge || 'Verified',
    rating: Number(p.rating) || 5.0,
    reviews: p.reviews_count || 0,
    sales: p.sales_count || 0,
    author: {
      id: p.seller_id || 'dev_seller',
      name: p.seller_name || 'Verified Developer',
      avatar: p.seller_avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=seller&backgroundColor=6366f1'
    },
    liveDemoUrl: p.live_demo_url || null,
    downloadUrl: p.download_url || null,
    thumb: p.thumbnail || `https://picsum.photos/seed/${encodeURIComponent(p.title)}/400/250`,
    tags: Array.isArray(p.tags) ? p.tags : (typeof p.tags === 'string' ? JSON.parse(p.tags || '[]') : ['Code']),
    features: Array.isArray(p.features) ? p.features : [],
    techStack: Array.isArray(p.tech_stack) ? p.tech_stack : [],
    createdAt: p.created_at || new Date().toISOString()
  };
}

// ── List Products with Filtering & Sorting ────────────────────
router.get('/', async (req, res) => {
  try {
    let products = [];

    // Attempt live fetch from Supabase first
    if (isConfigured() && supabase) {
      try {
        const { data, error } = await supabase.from('products').select('*').order('created_at', { ascending: false });
        if (!error && Array.isArray(data) && data.length > 0) {
          products = data.map(formatSupabaseProduct);
        }
      } catch (sbErr) {
        console.warn('[Products] Live Supabase query fallback to local:', sbErr.message);
      }
    }

    // Fallback to local memory/JSON if Supabase returned 0 or failed
    if (products.length === 0) {
      products = [...db.get('products')];
    }
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
router.get('/:id', async (req, res) => {
  try {
    let product = db.findById('products', req.params.id);

    // If not found in local db, query Supabase cloud database
    if (!product && isConfigured() && supabase) {
      try {
        const { data, error } = await supabase.from('products').select('*').eq('id', req.params.id).limit(1);
        if (!error && data && data.length > 0) {
          product = formatSupabaseProduct(data[0]);
        }
      } catch (sbErr) {
        console.warn('[Products] Single fetch Supabase fallback:', sbErr.message);
      }
    }

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
router.post('/', authOptional, async (req, res) => {
  try {
    const { title, category, price, oldPrice, description, tags, thumb, type, badge, videoUrl, downloadUrl, bundleInfo, author: bodyAuthor } = req.body;

    if (!title || !category || price === undefined || price === null || isNaN(Number(price))) {
      return res.status(400).json({ success: false, error: 'Title, category and a valid price (>= 0) are required' });
    }

    // Determine author from authenticated context, explicit payload, or headers
    let author = null;

    if (req.user && req.user.name) {
      author = {
        id: req.user.id,
        name: req.user.name,
        username: req.user.username || ('@' + req.user.name.toLowerCase().replace(/\s+/g, '_')),
        avatar: req.user.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(req.user.name)}&backgroundColor=ff5b36`
      };
    } else if (bodyAuthor && bodyAuthor.name) {
      author = {
        id: bodyAuthor.id || ('u_' + Date.now()),
        name: bodyAuthor.name,
        username: bodyAuthor.username || ('@' + bodyAuthor.name.toLowerCase().replace(/\s+/g, '_')),
        avatar: bodyAuthor.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(bodyAuthor.name)}&backgroundColor=ff5b36`
      };
    } else if (req.headers['x-user-id'] || req.headers['x-user-name']) {
      const hName = req.headers['x-user-name'] ? decodeURIComponent(req.headers['x-user-name']) : null;
      const hId = req.headers['x-user-id'];
      const u = hId ? db.findById('users', hId) : null;
      if (u) {
        author = { id: u.id, name: u.name, username: u.username, avatar: u.avatar };
      } else if (hName) {
        author = {
          id: hId || ('u_' + Date.now()),
          name: hName,
          username: '@' + hName.toLowerCase().replace(/\s+/g, '_'),
          avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(hName)}&backgroundColor=ff5b36`
        };
      }
    }

    if (!author) {
      author = {
        id: 'dev_seller',
        name: 'Verified Developer',
        username: '@dev_seller',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=dev&backgroundColor=6366f1'
      };
    }

    // Ensure the creator exists in Supabase users table to satisfy foreign key constraints
    let validSellerId = null;
    if (isConfigured() && supabase && author && author.id && author.id !== 'dev_seller' && author.id !== 'dev_guest') {
      try {
        // First check if user exists by id in Supabase
        const { data: existingById } = await supabase.from('users').select('id').eq('id', author.id).maybeSingle();
        if (existingById && existingById.id) {
          validSellerId = existingById.id;
        } else {
          // Check by email
          const checkEmail = (req.user && req.user.email) || `${author.id}@creator.smarthub.io`;
          const { data: existingByEmail } = await supabase.from('users').select('id').eq('email', checkEmail).maybeSingle();
          if (existingByEmail && existingByEmail.id) {
            validSellerId = existingByEmail.id;
          } else {
            // Attempt inserting creator into Supabase users table
            const { data: newSbUser, error: uErr } = await supabase.from('users').upsert([{
              id: author.id,
              name: author.name,
              username: author.username || ('@' + author.name.toLowerCase().replace(/\s+/g, '_')),
              email: checkEmail,
              password_hash: '',
              avatar: author.avatar || null,
              role: (req.user && req.user.role) || 'seller',
              wallet_balance: 0,
              xp: 0,
              badges: 0,
              location: 'India',
              headline: 'Smart Hub Creator',
              created_at: new Date().toISOString()
            }], { onConflict: 'id' }).select('id').maybeSingle();

            if (!uErr && newSbUser) {
              validSellerId = newSbUser.id;
            }
          }
        }
      } catch (uErr) {
        console.warn('[Products] Creator user resolution notice:', uErr.message);
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

    // Persist directly and immediately to Supabase
    if (isConfigured() && supabase) {
      try {
        const row = {
          id: newProduct.id,
          title: newProduct.title,
          description: newProduct.description,
          price: newProduct.price,
          original_price: newProduct.oldPrice,
          category: newProduct.category,
          badge: newProduct.badge,
          rating: newProduct.rating,
          reviews_count: newProduct.reviews,
          sales_count: newProduct.sales,
          seller_id: validSellerId,
          seller_name: newProduct.author.name,
          seller_avatar: newProduct.author.avatar,
          live_demo_url: newProduct.videoUrl,
          download_url: newProduct.downloadUrl,
          thumbnail: newProduct.thumb,
          tags: newProduct.tags,
          features: [],
          tech_stack: [newProduct.category],
          created_at: newProduct.createdAt
        };
        let { error: insErr } = await supabase.from('products').upsert([row], { onConflict: 'id' });
        // If foreign key constraint failed, retry with seller_id: null to guarantee persistence
        if (insErr && insErr.code === '23503') {
          console.warn('[Products] Foreign key retry with seller_id: null for product persistence');
          row.seller_id = null;
          const retry = await supabase.from('products').upsert([row], { onConflict: 'id' });
          insErr = retry.error;
        }

        if (insErr) {
          console.warn('[Products] Supabase insert warning:', insErr.message);
        } else {
          console.log(`[Products] Successfully persisted product "${newProduct.title}" to Supabase!`);
        }
      } catch (sbErr) {
        console.warn('[Products] Supabase write error:', sbErr.message);
      }
    }

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
router.put('/:id', authRequired, async (req, res) => {
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

    if (isConfigured() && supabase) {
      try {
        const updateRow = {};
        if (req.body.title) updateRow.title = req.body.title;
        if (req.body.description) updateRow.description = req.body.description;
        if (req.body.price !== undefined) updateRow.price = Number(req.body.price);
        if (req.body.category) updateRow.category = req.body.category;
        if (req.body.tags) updateRow.tags = req.body.tags;
        if (req.body.thumb) updateRow.thumbnail = req.body.thumb;
        updateRow.updated_at = new Date().toISOString();
        await supabase.from('products').update(updateRow).eq('id', req.params.id);
      } catch (e) { }
    }

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
router.delete('/:id', authRequired, async (req, res) => {
  try {
    const success = db.delete('products', req.params.id);
    if (!success) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    if (isConfigured() && supabase) {
      try {
        await supabase.from('products').delete().eq('id', req.params.id);
      } catch (e) { }
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
