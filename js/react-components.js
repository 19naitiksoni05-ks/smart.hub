// ============================================================
// SMART HUB — Interactive React 18 Engine & Components
// Rich interactivity: Command Palette, Live Cart Drawer,
// Product Studio, Review Rater, and Seller WYSIWYG Publisher.
// ============================================================

(function () {
  'use strict';

  // Wait for React and ReactDOM
  function ensureReact(callback) {
    if (window.React && window.ReactDOM) {
      callback();
      return;
    }
    let loadedCount = 0;
    function checkLoaded() {
      loadedCount++;
      if (loadedCount >= 2 && window.React && window.ReactDOM) {
        callback();
      }
    }
    if (!window.React) {
      const s1 = document.createElement('script');
      s1.src = 'https://unpkg.com/react@18/umd/react.production.min.js';
      s1.onload = checkLoaded;
      document.head.appendChild(s1);
    } else {
      loadedCount++;
    }
    if (!window.ReactDOM) {
      const s2 = document.createElement('script');
      s2.src = 'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js';
      s2.onload = checkLoaded;
      document.head.appendChild(s2);
    } else {
      loadedCount++;
    }
  }

  // ── Cart Storage Helper ─────────────────────────────────────
  const CartStore = {
    get() {
      try {
        const raw = localStorage.getItem('smarthub_cart');
        if (raw) return JSON.parse(raw);
      } catch (e) {}
      return [];
    },
    set(items) {
      try {
        localStorage.setItem('smarthub_cart', JSON.stringify(items));
      } catch (e) {}
      window.dispatchEvent(new CustomEvent('cart-updated', { detail: items }));
      // Update header badge if present
      const badge = document.getElementById('header-cart-count');
      if (badge) {
        const count = items.reduce((sum, it) => sum + it.qty, 0);
        badge.textContent = count;
        badge.style.display = count > 0 ? 'flex' : 'none';
      }
    },
    add(product) {
      const current = this.get();
      const existing = current.find(p => p.id === product.id);
      if (existing) {
        existing.qty += 1;
      } else {
        current.push({
          id: product.id,
          title: product.title,
          category: product.category,
          price: product.price,
          qty: 1,
          thumb: product.thumb || 'https://picsum.photos/seed/product/400/250',
          badge: product.badge || null
        });
      }
      this.set(current);
      if (window.showToast) window.showToast(`Added "${product.title}" to cart! 🛒`, 'success');
    },
    remove(id) {
      const current = this.get().filter(p => p.id !== id);
      this.set(current);
      if (window.showToast) window.showToast('Item removed from cart', 'info');
    },
    updateQty(id, delta) {
      const current = this.get();
      const item = current.find(p => p.id === id);
      if (!item) return;
      item.qty += delta;
      if (item.qty <= 0) {
        this.set(current.filter(p => p.id !== id));
      } else {
        this.set(current);
      }
    }
  };

  window.SmartHubCart = CartStore;

  // Global helper for non-React code to add to cart
  window.addToCart = function (product) {
    if (typeof product === 'string') {
      const found = (window.SmartHubData && window.SmartHubData.products)
        ? window.SmartHubData.products.find(p => p.id === product)
        : null;
      if (found) CartStore.add(found);
    } else if (product && product.id) {
      CartStore.add(product);
    }
    window.dispatchEvent(new CustomEvent('open-cart'));
  };

  // ── Init React App Mounts ───────────────────────────────────
  ensureReact(() => {
    const { useState, useEffect, useRef, createElement: h } = window.React;

    // ──────────────────────────────────────────────────────────
    // 1. REACT SLIDE-OUT CART DRAWER
    // ──────────────────────────────────────────────────────────
    function CartDrawer() {
      const [isOpen, setIsOpen] = useState(false);
      const [cart, setCart] = useState(CartStore.get());
      const [coupon, setCoupon] = useState('');
      const [discountPercent, setDiscountPercent] = useState(0);
      const [couponApplied, setCouponApplied] = useState(false);
      const [payMethod, setPayMethod] = useState('wallet');

      useEffect(() => {
        const handleOpen = () => setIsOpen(true);
        const handleClose = () => setIsOpen(false);
        const handleUpdate = (e) => setCart(e.detail || CartStore.get());

        window.addEventListener('open-cart', handleOpen);
        window.addEventListener('close-cart', handleClose);
        window.addEventListener('cart-updated', handleUpdate);

        // Header cart button listener
        const headerBtn = document.getElementById('header-cart-btn');
        if (headerBtn) {
          headerBtn.onclick = (e) => {
            e.preventDefault();
            setIsOpen(prev => !prev);
          };
        }

        // Initialize header badge
        CartStore.set(CartStore.get());

        return () => {
          window.removeEventListener('open-cart', handleOpen);
          window.removeEventListener('close-cart', handleClose);
          window.removeEventListener('cart-updated', handleUpdate);
        };
      }, []);

      const subtotal = cart.reduce((sum, it) => sum + (it.price * it.qty), 0);
      const discount = Math.round(subtotal * (discountPercent / 100));
      const total = Math.max(0, subtotal - discount);

      function applyCoupon() {
        const code = coupon.trim().toUpperCase();
        if (code === 'OUTLINE10') {
          setDiscountPercent(10);
          setCouponApplied(true);
          if (window.showToast) window.showToast('Coupon OUTLINE10 applied: 10% OFF! 🎉', 'success');
        } else if (code === 'SMART50') {
          setDiscountPercent(50);
          setCouponApplied(true);
          if (window.showToast) window.showToast('Coupon SMART50 applied: 50% OFF! 🚀', 'success');
        } else {
          if (window.showToast) window.showToast('Invalid coupon code. Try "OUTLINE10"', 'error');
        }
      }

      if (!isOpen) return null;

      return h('div', { className: 'react-drawer-overlay', onClick: () => setIsOpen(false) },
        h('div', {
          className: 'react-cart-drawer',
          onClick: (e) => e.stopPropagation()
        },
          // Header
          h('div', { className: 'drawer-header' },
            h('div', { className: 'drawer-title' },
              h('span', { style: { fontSize: '1.25rem' } }, '🛒'),
              h('span', { style: { fontWeight: 800, fontSize: '1.1rem' } }, 'Shopping Cart'),
              h('span', { className: 'cart-chip-count' }, `[ ${cart.reduce((s, i) => s + i.qty, 0)} ITEMS ]`)
            ),
            h('button', {
              className: 'drawer-close-btn',
              onClick: () => setIsOpen(false),
              'aria-label': 'Close Cart'
            }, '✕')
          ),

          // Body
          h('div', { className: 'drawer-body' },
            cart.length === 0
              ? h('div', { className: 'empty-cart-state' },
                  h('div', { style: { fontSize: '3rem', marginBottom: '12px' } }, '🛍️'),
                  h('h4', { style: { marginBottom: '8px' } }, 'Your cart is empty'),
                  h('p', { style: { fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '20px' } },
                    'Discover verified source codes, full-stack templates & tools in the catalog.'
                  ),
                  h('a', {
                    href: 'marketplace.html',
                    className: 'btn btn-primary',
                    onClick: () => setIsOpen(false)
                  }, 'Explore Marketplace →')
                )
              : h('div', { className: 'cart-items-list' },
                  cart.map(item =>
                    h('div', { key: item.id, className: 'cart-item-row' },
                      h('img', { src: item.thumb, alt: item.title, className: 'cart-item-img' }),
                      h('div', { className: 'cart-item-details' },
                        h('div', { className: 'cart-item-category' }, `[ ${item.category} ]`),
                        h('div', { className: 'cart-item-title' }, item.title),
                        h('div', { className: 'cart-item-price-unit' }, `₹${item.price.toLocaleString('en-IN')}`),
                        h('div', { className: 'cart-qty-controls' },
                          h('button', {
                            className: 'qty-btn',
                            onClick: () => CartStore.updateQty(item.id, -1)
                          }, '−'),
                          h('span', { className: 'qty-number' }, item.qty),
                          h('button', {
                            className: 'qty-btn',
                            onClick: () => CartStore.updateQty(item.id, 1)
                          }, '+'),
                          h('button', {
                            className: 'remove-btn',
                            onClick: () => CartStore.remove(item.id)
                          }, 'Remove')
                        )
                      ),
                      h('div', { className: 'cart-item-total' },
                        `₹${(item.price * item.qty).toLocaleString('en-IN')}`
                      )
                    )
                  )
                )
          ),

          // Footer
          cart.length > 0 && h('div', { className: 'drawer-footer' },
            // Coupon section
            h('div', { className: 'cart-coupon-box' },
              h('input', {
                type: 'text',
                placeholder: 'Enter promo code (e.g. OUTLINE10)',
                value: coupon,
                onChange: (e) => setCoupon(e.target.value),
                className: 'coupon-input',
                disabled: couponApplied
              }),
              h('button', {
                className: 'coupon-apply-btn',
                onClick: applyCoupon,
                disabled: couponApplied
              }, couponApplied ? 'Applied ✓' : 'Apply')
            ),

            // Summary
            h('div', { className: 'cart-summary-breakdown' },
              h('div', { className: 'summary-line' },
                h('span', null, 'Subtotal:'),
                h('span', { className: 'font-mono' }, `₹${subtotal.toLocaleString('en-IN')}`)
              ),
              discountPercent > 0 && h('div', { className: 'summary-line discount' },
                h('span', null, `Discount (${discountPercent}%):`),
                h('span', { className: 'font-mono' }, `-₹${discount.toLocaleString('en-IN')}`)
              ),
              h('div', { className: 'summary-line' },
                h('span', null, 'Instant Key Delivery:'),
                h('span', { style: { color: 'var(--accent-green)', fontWeight: 700 } }, '₹0 FREE')
              ),
              h('div', { className: 'summary-total-line' },
                h('span', null, 'Grand Total:'),
                h('span', { className: 'total-amount' }, `₹${total.toLocaleString('en-IN')}`)
              )
            ),

            // Checkout CTA
            h('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } },
              h('a', {
                href: `checkout.html?discount=${discountPercent}`,
                className: 'btn btn-primary drawer-checkout-btn',
                onClick: () => setIsOpen(false)
              },
                h('span', null, '🔐 Proceed to Encrypted Checkout →'),
                h('span', { className: 'checkout-total-pill' }, `₹${total.toLocaleString('en-IN')}`)
              ),
              h('div', { className: 'drawer-guarantee' },
                '⚡ Verified code · End-to-end encrypted download · Instant UPI'
              )
            )
          )
        )
      );
    }

    // ──────────────────────────────────────────────────────────
    // 2. REACT SPOTLIGHT COMMAND PALETTE (Cmd+K / Search)
    // ──────────────────────────────────────────────────────────
    function CommandPalette() {
      const [isOpen, setIsOpen] = useState(false);
      const [query, setQuery] = useState('');
      const [filter, setFilter] = useState('all');
      const [selectedIndex, setSelectedIndex] = useState(0);
      const inputRef = useRef(null);

      // Search index
      const products = (window.SmartHubData && window.SmartHubData.products) || [];
      const actions = [
        { title: 'Toggle Theme (Dark / Light Outline)', category: 'Action', icon: '☀️', run: () => {
          const btn = document.getElementById('theme-toggle-btn');
          if (btn) btn.click();
        }},
        { title: 'Top-up Rupee Wallet via UPI', category: 'Action', icon: '💰', url: 'wallet.html' },
        { title: 'Open Creator Studio (List New Asset)', category: 'Action', icon: '🚀', url: 'seller-dashboard.html' },
        { title: 'Solve Coding Challenges & Earn XP', category: 'Action', icon: '🏆', url: 'challenges.html' },
        { title: 'Browse Verified Codes in Marketplace', category: 'Navigation', icon: '📦', url: 'marketplace.html' },
        { title: 'View Developer Profile & Heatmap', category: 'Navigation', icon: '👤', url: 'profile.html' },
        { title: 'Open Shopping Cart Drawer', category: 'Action', icon: '🛒', run: () => {
          window.dispatchEvent(new CustomEvent('open-cart'));
        }}
      ];

      useEffect(() => {
        const handleKeyDown = (e) => {
          // Cmd+K or Ctrl+K or / (when not focused on an input)
          if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
            e.preventDefault();
            setIsOpen(prev => !prev);
          } else if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
            e.preventDefault();
            setIsOpen(true);
          } else if (e.key === 'Escape' && isOpen) {
            setIsOpen(false);
          }
        };

        const handleCustomOpen = () => setIsOpen(true);

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('open-spotlight', handleCustomOpen);

        // Also wire input hint click
        const searchInput = document.getElementById('global-search-input');
        if (searchInput) {
          searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
              setQuery(searchInput.value);
              setIsOpen(true);
            }
          });
        }

        return () => {
          window.removeEventListener('keydown', handleKeyDown);
          window.removeEventListener('open-spotlight', handleCustomOpen);
        };
      }, [isOpen]);

      useEffect(() => {
        if (isOpen && inputRef.current) {
          setTimeout(() => inputRef.current.focus(), 50);
        }
      }, [isOpen]);

      if (!isOpen) return null;

      // Filtered results
      const q = query.trim().toLowerCase();
      const matchedProducts = products.filter(p =>
        !q || p.title.toLowerCase().includes(q) || p.category.toLowerCase().includes(q) || (p.tags && p.tags.some(t => t.toLowerCase().includes(q)))
      ).map(p => ({
        id: p.id,
        title: p.title,
        category: p.category,
        price: p.price,
        icon: '📦',
        url: `product-detail.html?id=${p.id}`,
        type: 'product'
      }));

      const matchedActions = actions.filter(a =>
        !q || a.title.toLowerCase().includes(q) || a.category.toLowerCase().includes(q)
      );

      let results = [];
      if (filter === 'all' || filter === 'products') results.push(...matchedProducts);
      if (filter === 'all' || filter === 'actions') results.push(...matchedActions);

      function handleSelect(item) {
        setIsOpen(false);
        if (item.run) {
          item.run();
        } else if (item.url) {
          window.location.href = item.url;
        }
      }

      return h('div', { className: 'react-spotlight-overlay', onClick: () => setIsOpen(false) },
        h('div', {
          className: 'react-spotlight-modal',
          onClick: (e) => e.stopPropagation()
        },
          // Input Box
          h('div', { className: 'spotlight-search-header' },
            h('span', { className: 'spotlight-icon' }, '🔍'),
            h('input', {
              ref: inputRef,
              type: 'text',
              className: 'spotlight-input',
              placeholder: 'Type to search products, actions, pages... (↑↓ navigate, ↵ select)',
              value: query,
              onChange: (e) => { setQuery(e.target.value); setSelectedIndex(0); },
              onKeyDown: (e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setSelectedIndex(prev => (prev + 1) % Math.max(1, results.length));
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setSelectedIndex(prev => (prev - 1 + results.length) % Math.max(1, results.length));
                } else if (e.key === 'Enter' && results[selectedIndex]) {
                  e.preventDefault();
                  handleSelect(results[selectedIndex]);
                }
              }
            }),
            h('span', { className: 'spotlight-esc-pill', onClick: () => setIsOpen(false) }, 'ESC')
          ),

          // Filter Pills
          h('div', { className: 'spotlight-filter-bar' },
            ['all', 'products', 'actions'].map(f =>
              h('button', {
                key: f,
                className: `spotlight-pill ${filter === f ? 'active' : ''}`,
                onClick: () => { setFilter(f); setSelectedIndex(0); }
              }, f.toUpperCase())
            )
          ),

          // Results List
          h('div', { className: 'spotlight-results-scroll' },
            results.length === 0
              ? h('div', { className: 'spotlight-empty' },
                  h('div', { style: { fontSize: '2rem', marginBottom: '8px' } }, '🔭'),
                  h('div', null, `No results for "${query}"`),
                  h('div', { style: { fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' } }, 'Try "React", "AI", "Wallet", or "Theme"')
                )
              : results.slice(0, 10).map((item, idx) =>
                  h('div', {
                    key: item.title + idx,
                    className: `spotlight-item ${idx === selectedIndex ? 'active' : ''}`,
                    onClick: () => handleSelect(item),
                    onMouseEnter: () => setSelectedIndex(idx)
                  },
                    h('div', { className: 'spotlight-item-left' },
                      h('span', { className: 'spotlight-item-icon' }, item.icon),
                      h('div', null,
                        h('div', { className: 'spotlight-item-title' }, item.title),
                        h('div', { className: 'spotlight-item-meta' }, `[ ${item.category} ]`)
                      )
                    ),
                    item.price
                      ? h('div', { className: 'spotlight-item-price' }, `₹${item.price.toLocaleString('en-IN')}`)
                      : h('span', { className: 'spotlight-enter-hint' }, 'Jump ↵')
                  )
                )
          ),

          // Footer
          h('div', { className: 'spotlight-footer' },
            h('span', null, '⚡ Interactive React Spotlight Palette · Press ⌘K anywhere'),
            h('span', null, 'smart.hub 2026')
          )
        )
      );
    }

    // ──────────────────────────────────────────────────────────
    // 3. REACT PRODUCT STUDIO (Mounted on product-detail.html)
    // ──────────────────────────────────────────────────────────
    function ProductStudio({ product }) {
      const [activeTab, setActiveTab] = useState('overview');
      const [license, setLicense] = useState('standard');
      const [viewport, setViewport] = useState('desktop');
      const [copied, setCopied] = useState(false);

      const prod = product || (window.SmartHubData && window.SmartHubData.products && window.SmartHubData.products.length > 0 ? window.SmartHubData.products[0] : null);

      if (!prod) {
        return h('div', { className: 'card p-6 text-center', style: { padding: '48px 24px' } },
          h('div', { style: { fontSize: '2.5rem', marginBottom: '12px' } }, '📦'),
          h('h4', { style: { marginBottom: '8px' } }, 'No Product Selected'),
          h('p', { style: { color: 'var(--text-muted)', marginBottom: '20px', fontSize: '0.9rem' } }, 'Explore our marketplace to discover verified developer source codes and digital assets.'),
          h('a', { href: 'marketplace.html', className: 'btn btn-primary btn-sm' }, 'Browse Marketplace →')
        );
      }

      const price = license === 'extended' ? Math.round(prod.price * 3.2) : prod.price;

      const codeSnippets = {
        overview: `// App.jsx — Next.js 15 & React 19 Client Hydration
import { SmartHubCommerce, CartProvider } from '@smarthub/react-ecom';

export default function StoreApp() {
  return (
    <CartProvider currency="INR" gateway="RazorpayUPI">
      <SmartHubCommerce 
        storeId="sh_store_9921"
        instantDeliveryKey="SH-ENC-VERIFIED"
        theme="dark-outline"
      />
    </CartProvider>
  );
}`,
        backend: `// server.js — Node.js / Express Microservice with UPI Webhook
const express = require('express');
const { generateEncryptedKey, verifyUPIPayment } = require('./smarthub-crypto');
const app = express();

app.post('/api/webhook/upi-success', async (req, res) => {
  const { transactionId, buyerEmail, productId } = req.body;
  const token = await generateEncryptedKey(productId, buyerEmail);
  await sendEncryptedEmail(buyerEmail, token);
  res.json({ status: 'DELIVERED_KEY', key: token });
});`,
        architecture: `// smarthub.config.json — Production Deployment Blueprint
{
  "framework": "nextjs-15-app-router",
  "database": "postgresql-prisma",
  "auth": "jwt-with-refresh-rotation",
  "payments": ["upi-instant", "razorpay", "wallet-balance"],
  "security": "aes-256-gcm-encrypted-delivery",
  "audit": "100% Malware Free & Passed Code Review"
}`
      };

      function copySnippet() {
        navigator.clipboard.writeText(codeSnippets[activeTab] || '');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }

      return h('div', { className: 'react-product-studio-card' },
        h('div', { className: 'studio-header' },
          h('div', { className: 'studio-title' },
            h('span', { className: 'pulse-dot' }),
            h('span', { style: { fontWeight: 700 } }, 'Interactive Developer Studio & Code Runner'),
            h('span', { className: 'badge badge-cyan' }, 'React 19 Ready')
          ),
          h('div', { className: 'viewport-toggles' },
            ['desktop', 'tablet', 'mobile'].map(v =>
              h('button', {
                key: v,
                className: `viewport-btn ${viewport === v ? 'active' : ''}`,
                onClick: () => setViewport(v)
              }, v === 'desktop' ? '🖥️ Desktop' : v === 'tablet' ? '📱 Tablet' : '📲 Mobile')
            )
          )
        ),

        // Tabs
        h('div', { className: 'studio-tab-bar' },
          h('button', {
            className: `studio-tab ${activeTab === 'overview' ? 'active' : ''}`,
            onClick: () => setActiveTab('overview')
          }, '⚛️ Client Component (App.jsx)'),
          h('button', {
            className: `studio-tab ${activeTab === 'backend' ? 'active' : ''}`,
            onClick: () => setActiveTab('backend')
          }, '⚙️ UPI Webhook (server.js)'),
          h('button', {
            className: `studio-tab ${activeTab === 'architecture' ? 'active' : ''}`,
            onClick: () => setActiveTab('architecture')
          }, '🔐 Architecture (config.json)')
        ),

        // Code display
        h('div', { className: `studio-code-box viewport-${viewport}` },
          h('pre', null, codeSnippets[activeTab]),
          h('button', { className: 'copy-code-btn', onClick: copySnippet },
            copied ? 'Copied ✓' : 'Copy Code 📋'
          )
        ),

        // Interactive License & Action Bar
        h('div', { className: 'studio-license-bar' },
          h('div', { className: 'license-options' },
            h('label', { className: `license-radio ${license === 'standard' ? 'selected' : ''}` },
              h('input', {
                type: 'radio',
                name: 'license',
                checked: license === 'standard',
                onChange: () => setLicense('standard')
              }),
              h('div', null,
                h('div', { style: { fontWeight: 700 } }, 'Standard License'),
                h('div', { style: { fontSize: '0.72rem', color: 'var(--text-muted)' } }, '1 Domain / Personal or Single Client')
              ),
              h('div', { className: 'license-price' }, `₹${prod.price.toLocaleString('en-IN')}`)
            ),
            h('label', { className: `license-radio ${license === 'extended' ? 'selected' : ''}` },
              h('input', {
                type: 'radio',
                name: 'license',
                checked: license === 'extended',
                onChange: () => setLicense('extended')
              }),
              h('div', null,
                h('div', { style: { fontWeight: 700 } }, 'Extended SaaS License'),
                h('div', { style: { fontSize: '0.72rem', color: 'var(--text-muted)' } }, 'Unlimited Commercial Projects & Resale')
              ),
              h('div', { className: 'license-price' }, `₹${Math.round(prod.price * 3.2).toLocaleString('en-IN')}`)
            )
          ),

          // CTAs
          h('div', { className: 'studio-cta-group' },
            h('button', {
              className: 'btn btn-outline',
              onClick: () => window.addToCart({ ...prod, price })
            }, '🛒 Add to Cart'),
            h('a', {
              href: `checkout.html?id=${prod.id}&license=${license}`,
              className: 'btn btn-primary'
            }, `Instant Buy for ₹${price.toLocaleString('en-IN')} →`)
          )
        )
      );
    }

    // ──────────────────────────────────────────────────────────
    // 4. REACT RATING & REVIEW POSTER (Mounted on product-detail.html)
    // ──────────────────────────────────────────────────────────
    function RatingWidget({ productId }) {
      const [rating, setRating] = useState(5);
      const [hoverRating, setHoverRating] = useState(0);
      const [text, setText] = useState('');
      const [reviewsList, setReviewsList] = useState((window.SmartHubData && window.SmartHubData.reviews) || []);

      function submitReview(e) {
        e.preventDefault();
        if (!text.trim()) {
          if (window.showToast) window.showToast('Please type a short review before submitting!', 'error');
          return;
        }
        const user = (window.getCurrentUser && window.getCurrentUser()) || { name: 'Verified Developer' };
        const newRev = {
          id: 'rev_' + Date.now(),
          user: user.name,
          avatar: user.avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + encodeURIComponent(user.name) + '&backgroundColor=ff5b36',
          rating: rating,
          text: text.trim(),
          product: (product && product.title) || 'Source Code Asset',
          date: new Date().toISOString().split('T')[0],
          location: user.location || 'India'
        };
        setReviewsList([newRev, ...reviewsList]);
        setText('');
        if (window.showToast) window.showToast('Thank you! Your verified review is published! ⭐', 'success');
      }

      return h('div', { className: 'react-review-container' },
        // Submission Form
        h('form', { className: 'review-composer-card', onSubmit: submitReview },
          h('h4', { style: { marginBottom: '8px' } }, 'Leave a Verified Developer Review'),
          h('div', { className: 'star-picker' },
            [1, 2, 3, 4, 5].map(star =>
              h('span', {
                key: star,
                className: `star-interactive ${(hoverRating || rating) >= star ? 'filled' : ''}`,
                onMouseEnter: () => setHoverRating(star),
                onMouseLeave: () => setHoverRating(0),
                onClick: () => setRating(star)
              }, '★')
            ),
            h('span', { className: 'rating-label' },
              rating === 5 ? '5.0 — Outstanding Code!' :
              rating === 4 ? '4.0 — Very Good' :
              rating === 3 ? '3.0 — Average' :
              rating === 2 ? '2.0 — Needs Improvement' : '1.0 — Poor'
            )
          ),
          h('textarea', {
            className: 'review-textarea',
            placeholder: 'How was the code quality, documentation, and installation experience? Share feedback for the developer community...',
            rows: 3,
            value: text,
            onChange: (e) => setText(e.target.value)
          }),
          h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' } },
            h('span', { style: { fontSize: '0.75rem', color: 'var(--text-muted)' } }, '🔒 Verified Purchase Review (Attached to ₹ INR Transaction)'),
            h('button', { type: 'submit', className: 'btn btn-primary btn-sm' }, 'Post Review ⭐')
          )
        ),

        // Live Reviews List
        h('div', { className: 'live-reviews-feed', style: { marginTop: '24px' } },
          reviewsList.length === 0
            ? h('div', { className: 'card p-4 text-center', style: { padding: '24px', color: 'var(--text-muted)', fontSize: '0.9rem' } },
                '⭐ No reviews yet. Be the first verified buyer to leave feedback!'
              )
            : reviewsList.map(r =>
                h('div', { key: r.id, className: 'review-card' },
                  h('div', { className: 'review-header' },
                    h('img', { src: r.avatar, alt: r.user, className: 'avatar avatar-md' }),
                    h('div', { className: 'review-info' },
                      h('div', { className: 'reviewer-name' }, r.user),
                      h('div', { className: 'reviewer-meta' }, `${r.location} · ${r.date}`),
                      h('div', { className: 'stars' }, '★'.repeat(r.rating) + '☆'.repeat(5 - r.rating))
                    )
                  ),
                  h('p', { className: 'review-text' }, r.text)
                )
              )
        )
      );
    }

    // ──────────────────────────────────────────────────────────
    // 5. REACT SELLER STUDIO (Mounted on seller-dashboard.html)
    // ──────────────────────────────────────────────────────────
    function SellerStudio() {
      const [title, setTitle] = useState('');
      const [category, setCategory] = useState('React');
      const [price, setPrice] = useState(1999);
      const [tags, setTags] = useState('');
      const [desc, setDesc] = useState('');
      const [isPublished, setIsPublished] = useState(false);

      // Dynamic platform fee (0.5% - 3% based on price and category) + statutory tax
      let feePct = 2.0;
      if (price >= 10000) feePct = 0.5;
      else if (price >= 3000) feePct = 1.2;
      else if (price >= 1000) feePct = 2.0;
      else feePct = 3.0;

      if (category === 'AI/ML' || category === 'Blockchain') {
        feePct = Math.max(0.5, +(feePct * 0.9).toFixed(2));
      }

      const fee = Math.round(price * (feePct / 100));
      const tax = Math.round(fee * 0.18); // 18% statutory GST on fee
      const netProfit = Math.max(0, price - fee - tax);
      const retentionPct = price > 0 ? ((netProfit / price) * 100).toFixed(1) : '99.5';
      const traditionalFee = Math.round(price * 0.30); // 30% competitor cut

      function handlePublish(e) {
        e.preventDefault();
        setIsPublished(true);
        if (window.showToast) {
          window.showToast(`🎉 "${title}" listed successfully! Up to 99.5% royalty retention activated.`, 'success');
        }
      }

      return h('div', { className: 'seller-studio-grid' },
        // Left Column: Form
        h('div', { className: 'seller-form-card' },
          h('div', { className: 'form-eyebrow' }, '[ LIVE PRODUCT PUBLISHER ]'),
          h('h3', { style: { marginBottom: '16px' } }, 'Publish New Digital Asset'),
          h('form', { onSubmit: handlePublish },
            h('div', { className: 'input-group', style: { marginBottom: '14px' } },
              h('label', { className: 'input-label' }, 'Product Title'),
              h('input', {
                type: 'text',
                className: 'input',
                value: title,
                onChange: (e) => setTitle(e.target.value),
                required: true
              })
            ),
            h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' } },
              h('div', { className: 'input-group' },
                h('label', { className: 'input-label' }, 'Category'),
                h('select', {
                  className: 'input',
                  value: category,
                  onChange: (e) => setCategory(e.target.value)
                },
                  h('option', { value: 'React' }, 'React & Next.js'),
                  h('option', { value: 'Mobile' }, 'Mobile & Flutter'),
                  h('option', { value: 'AI/ML' }, 'AI & Machine Learning'),
                  h('option', { value: 'Templates' }, 'UI Kits & Templates'),
                  h('option', { value: 'Backend' }, 'Backend & APIs'),
                  h('option', { value: 'Blockchain' }, 'Blockchain & Web3')
                )
              ),
              h('div', { className: 'input-group' },
                h('label', { className: 'input-label' }, 'Price in ₹ INR'),
                h('input', {
                  type: 'number',
                  className: 'input font-mono',
                  value: price,
                  min: 0,
                  step: 100,
                  onChange: (e) => setPrice(Number(e.target.value))
                })
              )
            ),
            h('div', { className: 'input-group', style: { marginBottom: '14px' } },
              h('label', { className: 'input-label' }, 'Tech Tags (comma separated)'),
              h('input', {
                type: 'text',
                className: 'input',
                value: tags,
                onChange: (e) => setTags(e.target.value)
              })
            ),
            h('div', { className: 'input-group', style: { marginBottom: '18px' } },
              h('label', { className: 'input-label' }, 'Short Description'),
              h('textarea', {
                className: 'input',
                rows: 3,
                value: desc,
                onChange: (e) => setDesc(e.target.value)
              })
            ),

            // Revenue calculation
            h('div', { className: 'royalty-breakdown-card' },
              h('div', { style: { display: 'flex', justifyContent: 'space-between', marginBottom: '6px' } },
                h('span', null, 'Your Take-Home Profit:'),
                h('span', { style: { color: 'var(--accent-green)', fontWeight: 800, fontSize: '1.1rem' } }, `₹${netProfit.toLocaleString('en-IN')} (${retentionPct}%)`)
              ),
              h('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-muted)' } },
                h('span', null, `Smart Hub Platform Fee (${feePct}%):`),
                h('span', { style: { color: 'var(--accent-purple)', fontWeight: 700 } }, `₹${fee.toLocaleString('en-IN')} (Only on sales)`)
              ),
              h('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' } },
                h('span', null, 'Statutory Govt Tax (18% GST):'),
                h('span', { style: { color: 'var(--text-secondary)' } }, `₹${tax.toLocaleString('en-IN')}`)
              ),
              h('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--accent-green)', marginTop: '6px', paddingTop: '6px', borderTop: '1px dashed var(--border-outline-subtle)' } },
                h('span', null, 'Wallet Deposit Fee:'),
                h('span', { style: { fontWeight: 700 } }, '₹0 (0% Fee to Add Money)')
              ),
              h('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--accent-coral)', marginTop: '4px' } },
                h('span', null, 'Competitor Marketplaces Take:'),
                h('span', null, `-₹${traditionalFee.toLocaleString('en-IN')} (30% vs our ${feePct}%)`)
              )
            ),

            h('button', {
              type: 'submit',
              className: 'btn btn-primary w-full',
              style: { marginTop: '16px', width: '100%', justifyContent: 'center' }
            }, isPublished ? '✓ Published to Catalog' : '🚀 Publish Asset to Smart Hub')
          )
        ),

        // Right Column: Live Card Preview
        h('div', { className: 'seller-preview-card' },
          h('div', { className: 'preview-label' }, '// REAL-TIME LIVE PRODUCT CARD PREVIEW'),
          h('div', { className: 'product-card', style: { maxWidth: '380px', margin: '0 auto' } },
            h('div', { className: 'product-card-thumb' },
              h('img', { src: 'https://picsum.photos/seed/aipreview/400/250', alt: title }),
              h('div', { className: 'badge badge-cyan', style: { position: 'absolute', top: '10px', left: '10px' } }, '[ NEW DROP ]')
            ),
            h('div', { className: 'product-card-body' },
              h('div', { className: 'product-card-category' }, `[ ${category} ]`),
              h('div', { className: 'product-card-title' }, title),
              h('div', { className: 'product-card-meta' },
                h('div', { className: 'product-card-author' },
                  h('img', { src: ((window.getCurrentUser && window.getCurrentUser()) || {}).avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=creator&backgroundColor=ff5b36', alt: 'Author' }),
                  `${((window.getCurrentUser && window.getCurrentUser()) || {}).name || 'Creator'} (You)`
                ),
                h('div', { className: 'product-card-stats' }, '★ 5.0 (New)')
              ),
              h('div', { className: 'tag-cloud' },
                tags.split(',').filter(Boolean).map(t => h('span', { key: t, className: 'tag' }, t.trim()))
              )
            ),
            h('div', { className: 'product-card-footer' },
              h('div', { className: 'price' }, `₹${Number(price || 0).toLocaleString('en-IN')}`),
              h('button', { className: 'btn btn-primary btn-sm' }, `Buy ₹${Number(price || 0).toLocaleString('en-IN')}`)
            )
          )
        )
      );
    }

    // ──────────────────────────────────────────────────────────
    // 6. MOUNT COMPONENT CONTAINERS
    // ──────────────────────────────────────────────────────────
    function mountReactRoots() {
      // 1. Mount Global Cart Drawer
      let cartRoot = document.getElementById('react-cart-root');
      if (!cartRoot) {
        cartRoot = document.createElement('div');
        cartRoot.id = 'react-cart-root';
        document.body.appendChild(cartRoot);
      }
      const cartApp = window.ReactDOM.createRoot ? window.ReactDOM.createRoot(cartRoot) : null;
      if (cartApp) {
        cartApp.render(h(CartDrawer));
      } else {
        window.ReactDOM.render(h(CartDrawer), cartRoot);
      }

      // 2. Mount Global Command Palette
      let spotlightRoot = document.getElementById('react-spotlight-root');
      if (!spotlightRoot) {
        spotlightRoot = document.createElement('div');
        spotlightRoot.id = 'react-spotlight-root';
        document.body.appendChild(spotlightRoot);
      }
      const spotlightApp = window.ReactDOM.createRoot ? window.ReactDOM.createRoot(spotlightRoot) : null;
      if (spotlightApp) {
        spotlightApp.render(h(CommandPalette));
      } else {
        window.ReactDOM.render(h(CommandPalette), spotlightRoot);
      }

      // 3. Mount Product Studio if container exists
      const studioContainer = document.getElementById('react-product-studio');
      if (studioContainer) {
        const urlParams = new URLSearchParams(window.location.search);
        const prodId = urlParams.get('id');
        const prod = (prodId && window.SmartHubData && window.SmartHubData.products)
          ? window.SmartHubData.products.find(p => p.id === prodId)
          : null;

        const studioApp = window.ReactDOM.createRoot ? window.ReactDOM.createRoot(studioContainer) : null;
        if (studioApp) {
          studioApp.render(h(ProductStudio, { product: prod }));
        } else {
          window.ReactDOM.render(h(ProductStudio, { product: prod }), studioContainer);
        }
      }

      // 4. Mount Rating Widget if container exists
      const ratingContainer = document.getElementById('react-rating-widget');
      if (ratingContainer) {
        const ratingApp = window.ReactDOM.createRoot ? window.ReactDOM.createRoot(ratingContainer) : null;
        if (ratingApp) {
          ratingApp.render(h(RatingWidget));
        } else {
          window.ReactDOM.render(h(RatingWidget), ratingContainer);
        }
      }

      // 5. Mount Seller Studio if container exists
      const sellerContainer = document.getElementById('react-seller-studio');
      if (sellerContainer) {
        const sellerApp = window.ReactDOM.createRoot ? window.ReactDOM.createRoot(sellerContainer) : null;
        if (sellerApp) {
          sellerApp.render(h(SellerStudio));
        } else {
          window.ReactDOM.render(h(SellerStudio), sellerContainer);
        }
      }
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', mountReactRoots);
    } else {
      mountReactRoots();
    }
  });

})();
