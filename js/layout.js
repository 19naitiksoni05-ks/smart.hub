// ============================================================
// SMART HUB — Shared Layout Renderer (Header & Footer)
// Spacious Two-Tier Non-Congested Architectural Header
// ============================================================
function getSessionUser() {
  try {
    const saved = localStorage.getItem('smarthub_user');
    if (saved) {
      const u = JSON.parse(saved);
      if (u && u.isLoggedIn) {
        if (['priya', 'arjun', 'sharma', 'sneha', 'demo', 'test', 'example.com'].some(term => 
          (u.name && u.name.toLowerCase().includes(term)) ||
          (u.username && u.username.toLowerCase().includes(term)) ||
          (u.email && u.email.toLowerCase().includes(term))
        ) || u.xp === 4100 || u.xp === 4850) {
          localStorage.removeItem('smarthub_user');
          return null;
        }
        return u;
      }
    }
  } catch (e) {}
  return null;
}

function renderHeader(activePage = '') {
  const user = getSessionUser();
  const isLoggedIn = user && user.isLoggedIn;
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';

  return `
  <!-- ── Top Announcement Ticker ── -->
  <div class="top-ticker" id="top-ticker">
    <div class="ticker-content">
      <span class="ticker-badge">[ 2026 EDITION ]</span>
      <span>✦ INDIA'S PREMIER DIGITAL ASSETS HUB • VERIFIED SOURCE PACKAGES • INSTANT ENCRYPTED DELIVERY</span>
      <span class="ticker-badge">CODE: OUTLINE10</span>
      <span>FOR 10% OFF • <a href="marketplace.html" class="ticker-link">EXPLORE STORE →</a></span>
    </div>
  </div>

  <!-- ── Main Architectural Header (Spacious Two-Tier Layout) ── -->
  <header class="header" id="header">
    
    <!-- ── Tier 1: Primary Brand, Command Search & Account Hub (Edge-to-Edge) ── -->
    <div class="header-primary-bar">
      <div class="header-fluid-container">
        <div class="header-primary-inner">

          <!-- Brand Logo (Pure smart.hub without box or tagline) -->
          <a href="index.html" class="brand-outline-logo" title="Smart Hub — Home">
            <span class="logo-smart">smart</span><span class="logo-dot">.</span><span class="logo-hub">hub</span>
          </a>

          <!-- Spacious Command Search Bar (No More Squeezing) -->
          <div class="topbar-search-wrap">
            <div class="topbar-search-box">
              <span class="search-icon">🔍</span>
              <input type="text" class="topbar-search-input" id="global-search-input" placeholder="Search verified codes, web apps, tools... (Press '/' or ⌘K)" autocomplete="off">
              <span class="search-kbd-hint" onclick="window.dispatchEvent(new CustomEvent('open-spotlight'))" title="Open Interactive React Spotlight">⌘K</span>
              <button class="search-clear-btn" id="global-search-clear" aria-label="Clear search">✕</button>
            </div>
            
            <!-- Live Search Autocomplete Popover Dropdown -->
            <div class="search-results-dropdown" id="global-search-dropdown">
              <div class="search-results-tabs">
                <button class="search-tab-pill active" data-search-filter="all">All</button>
                <button class="search-tab-pill" data-search-filter="products">Products</button>
                <button class="search-tab-pill" data-search-filter="pages">Pages</button>
              </div>
              <div class="search-items-list" id="global-search-results">
                <!-- Populated dynamically by search engine -->
              </div>
              <a href="marketplace.html" class="search-view-all" id="global-search-view-all">View All Products in Catalog →</a>
            </div>
          </div>

          <!-- Header Right Utilities: Theme, Settings, Cart & Profile (Decongested & Clean) -->
          <div class="header-actions">
            <!-- Theme Toggle -->
            <button class="theme-toggle-btn" id="theme-toggle-btn" title="Toggle Theme (Dark / Light Linen)" aria-label="Toggle theme">
              ${currentTheme === 'light' ? '🌙' : '☀️'}
            </button>

            <!-- Settings Option in Topbar -->
            <a href="settings.html" class="settings-btn ${activePage === 'settings.html' ? 'active' : ''}" id="header-settings-btn" title="Settings &amp; Preferences" aria-label="Settings">
              <span class="settings-icon">⚙️</span>
            </a>

            <!-- Interactive Cart Trigger (Opens React Cart Drawer) -->
            <button class="cart-trigger-btn" id="header-cart-btn" title="Open Interactive Cart Drawer" aria-label="Cart">
              <span class="cart-icon">🛒</span>
              <span class="cart-badge-count" id="header-cart-count" style="display:none;">0</span>
            </button>

            <!-- User Menu / Profile Link (Shows User Name & Leads to Profile Page) -->
            ${isLoggedIn ? `
            <div class="user-menu dropdown">
              <div class="user-btn-wrap">
                <a href="profile.html" class="user-avatar-btn" id="header-profile-btn" aria-label="View Profile for ${user.name}">
                  <img src="${user.avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=user&backgroundColor=ff5b36'}" class="user-avatar-mini" alt="${user.name}">
                  <span class="user-name">${user.name}</span>
                </a>
                <button class="user-dropdown-toggle" id="user-dropdown-toggle" aria-label="Account Menu" title="Open Account Menu">▾</button>
              </div>
              <div class="dropdown-menu" id="user-dropdown">
                <div class="dropdown-user-header">
                  <img src="${user.avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=user&backgroundColor=ff5b36'}" class="dropdown-avatar" alt="${user.name}">
                  <div class="dropdown-user-info">
                    <div class="dropdown-user-name">${user.name}</div>
                    <div class="dropdown-user-handle">${user.username || '@user'}</div>
                  </div>
                </div>
                <div class="dropdown-divider"></div>
                <a href="profile.html" class="dropdown-item">👤 View Profile</a>
                <a href="settings.html" class="dropdown-item">⚙️ Settings &amp; Preferences</a>
                <a href="profile.html#projects" class="dropdown-item">📦 My Purchased Assets</a>
                <a href="wallet.html" class="dropdown-item">💰 Wallet &amp; Payouts (₹${(user.walletBalance || 0).toLocaleString('en-IN')})</a>
                <a href="seller-dashboard.html" class="dropdown-item">🚀 Creator Studio</a>
                <a href="chat.html" class="dropdown-item">✉️ Messages</a>
                <div class="dropdown-divider"></div>
                <a href="login.html" class="dropdown-item">🔄 Switch Account</a>
                <a href="#" class="dropdown-item danger" id="header-signout-btn">🚪 Sign Out</a>
              </div>
            </div>
            ` : `
            <div class="header-auth-group">
              <a href="login.html" class="btn btn-outline header-btn-login">Log In</a>
              <a href="register.html" class="btn btn-primary header-btn-register">Register</a>
            </div>
            `}

            <!-- Mobile Hamburger -->
            <button class="hamburger" id="hamburger" aria-label="Toggle navigation">
              <span></span><span></span><span></span>
            </button>
          </div>

        </div>
      </div>
    </div>

    <!-- ── Tier 2: Dedicated Navigation Strip & Quick Highlights (Edge-to-Edge) ── -->
    <div class="header-secondary-bar">
      <div class="header-fluid-container">
        <div class="header-secondary-inner">

          <!-- Navigation Menu with Multi-level Dropdowns (Exact Options Preserved) -->
          <nav class="nav-outline-menu">
            
            <!-- 1. Marketplace & Store -->
            <div class="nav-item-dropdown">
              <a href="marketplace.html" class="nav-menu-btn ${['marketplace.html', 'product-detail.html'].includes(activePage) ? 'active' : ''}">
                <span class="nav-icon-mini">📦</span> Marketplace <span class="nav-menu-chevron">▾</span>
              </a>
              <div class="submenu-card">
                <div class="submenu-header">Digital Products &amp; Store</div>
                <a href="marketplace.html" class="submenu-link">
                  <div class="submenu-link-left">
                    <span class="submenu-icon">📦</span>
                    <div>
                      <span class="submenu-text-title">All Catalog Items</span>
                      <span class="submenu-text-desc">Curated verified codes &amp; templates</span>
                    </div>
                  </div>
                  <span class="submenu-badge hot">HOT</span>
                </a>
                <a href="marketplace.html?cat=React" class="submenu-link">
                  <div class="submenu-link-left">
                    <span class="submenu-icon">⚛️</span>
                    <div>
                      <span class="submenu-text-title">Web Apps &amp; React</span>
                      <span class="submenu-text-desc">Full-stack SaaS, Next.js &amp; portals</span>
                    </div>
                  </div>
                </a>
                <a href="marketplace.html?cat=Mobile" class="submenu-link">
                  <div class="submenu-link-left">
                    <span class="submenu-icon">📱</span>
                    <div>
                      <span class="submenu-text-title">Mobile &amp; Flutter</span>
                      <span class="submenu-text-desc">iOS &amp; Android ready apps</span>
                    </div>
                  </div>
                  <span class="submenu-badge new">NEW</span>
                </a>
                <a href="marketplace.html?cat=AI/ML" class="submenu-link">
                  <div class="submenu-link-left">
                    <span class="submenu-icon">🤖</span>
                    <div>
                      <span class="submenu-text-title">AI &amp; Machine Learning</span>
                      <span class="submenu-text-desc">GPT models, Python scripts &amp; tools</span>
                    </div>
                  </div>
                </a>
                <a href="marketplace.html?cat=Templates" class="submenu-link">
                  <div class="submenu-link-left">
                    <span class="submenu-icon">🎨</span>
                    <div>
                      <span class="submenu-text-title">UI Kits &amp; Templates</span>
                      <span class="submenu-text-desc">Design systems, Figma &amp; HTML5</span>
                    </div>
                  </div>
                </a>
                <a href="marketplace.html?cat=Backend" class="submenu-link">
                  <div class="submenu-link-left">
                    <span class="submenu-icon">⚙️</span>
                    <div>
                      <span class="submenu-text-title">Backend &amp; Microservices</span>
                      <span class="submenu-text-desc">Node.js, Docker &amp; REST APIs</span>
                    </div>
                  </div>
                </a>
                <a href="marketplace.html?cat=Blockchain" class="submenu-link">
                  <div class="submenu-link-left">
                    <span class="submenu-icon">🔗</span>
                    <div>
                      <span class="submenu-text-title">Blockchain &amp; Web3</span>
                      <span class="submenu-text-desc">Solidity smart contracts &amp; dApps</span>
                    </div>
                  </div>
                </a>
                <a href="marketplace.html?filter=free" class="submenu-link">
                  <div class="submenu-link-left">
                    <span class="submenu-icon">🎁</span>
                    <div>
                      <span class="submenu-text-title">Free Starter Assets</span>
                      <span class="submenu-text-desc">₹0 open-source codebases</span>
                    </div>
                  </div>
                  <span class="submenu-badge free">₹0 FREE</span>
                </a>
              </div>
            </div>

            <!-- 2. Ecosystem & Community -->
            <div class="nav-item-dropdown">
              <a href="ecosystem.html" class="nav-menu-btn ${['ecosystem.html', 'feed.html', 'community.html', 'challenges.html', 'chat.html'].includes(activePage) ? 'active' : ''}">
                <span class="nav-icon-mini">🌐</span> Ecosystem <span class="nav-menu-chevron">▾</span>
              </a>
              <div class="submenu-card">
                <div class="submenu-header">Developer Community &amp; Growth</div>
                <a href="ecosystem.html" class="submenu-link">
                  <div class="submenu-link-left">
                    <span class="submenu-icon">🌐</span>
                    <div>
                      <span class="submenu-text-title">Ecosystem Command Hub</span>
                      <span class="submenu-text-desc">Unified architecture radar &amp; live simulators</span>
                    </div>
                  </div>
                  <span class="submenu-badge new">RADAR</span>
                </a>
                <a href="feed.html" class="submenu-link">
                  <div class="submenu-link-left">
                    <span class="submenu-icon">📰</span>
                    <div>
                      <span class="submenu-text-title">Developer Feed</span>
                      <span class="submenu-text-desc">Tech updates, launches &amp; insights</span>
                    </div>
                  </div>
                </a>
                <a href="community.html" class="submenu-link">
                  <div class="submenu-link-left">
                    <span class="submenu-icon">💬</span>
                    <div>
                      <span class="submenu-text-title">Community Channels</span>
                      <span class="submenu-text-desc">Discord-style forums &amp; help desk</span>
                    </div>
                  </div>
                  <span class="submenu-badge hot">LIVE</span>
                </a>
                <a href="challenges.html" class="submenu-link">
                  <div class="submenu-link-left">
                    <span class="submenu-icon">🏆</span>
                    <div>
                      <span class="submenu-text-title">Coding Challenges</span>
                      <span class="submenu-text-desc">Build real projects, earn XP &amp; badges</span>
                    </div>
                  </div>
                  <span class="submenu-badge new">XP</span>
                </a>
                <a href="chat.html" class="submenu-link">
                  <div class="submenu-link-left">
                    <span class="submenu-icon">✉️</span>
                    <div>
                      <span class="submenu-text-title">Direct Messages</span>
                      <span class="submenu-text-desc">Private buyer-seller communications</span>
                    </div>
                  </div>
                </a>
              </div>
            </div>

            <!-- 3. Services & Wallet -->
            <div class="nav-item-dropdown">
              <a href="wallet.html" class="nav-menu-btn ${['wallet.html', 'profile.html', 'seller-dashboard.html', 'checkout.html'].includes(activePage) ? 'active' : ''}">
                <span class="nav-icon-mini">⚡</span> Services <span class="nav-menu-chevron">▾</span>
              </a>
              <div class="submenu-card">
                <div class="submenu-header">Monetization &amp; Identity</div>
                <a href="wallet.html" class="submenu-link">
                  <div class="submenu-link-left">
                    <span class="submenu-icon">💰</span>
                    <div>
                      <span class="submenu-text-title">Rupee Wallet &amp; UPI</span>
                      <span class="submenu-text-desc">0% fee to add funds · Instant payouts</span>
                    </div>
                  </div>
                </a>
                <a href="profile.html" class="submenu-link">
                  <div class="submenu-link-left">
                    <span class="submenu-icon">👤</span>
                    <div>
                      <span class="submenu-text-title">Developer Portfolio</span>
                      <span class="submenu-text-desc">Verified skills, products &amp; GitHub stats</span>
                    </div>
                  </div>
                </a>
                <a href="seller-dashboard.html" class="submenu-link">
                  <div class="submenu-link-left">
                    <span class="submenu-icon">🚀</span>
                    <div>
                      <span class="submenu-text-title">Seller Onboarding &amp; Studio</span>
                      <span class="submenu-text-desc">List your digital assets with up to 99.5% royalty</span>
                    </div>
                  </div>
                  <span class="submenu-badge hot">UP TO 99.5%</span>
                </a>
              </div>
            </div>

            <!-- 4. Company & Vision -->
            <div class="nav-item-dropdown">
              <a href="index.html#about" class="nav-menu-btn">
                <span class="nav-icon-mini">🏢</span> Company <span class="nav-menu-chevron">▾</span>
              </a>
              <div class="submenu-card">
                <div class="submenu-header">Vision &amp; Guarantees</div>
                <a href="index.html#about" class="submenu-link">
                  <div class="submenu-link-left">
                    <span class="submenu-icon">💡</span>
                    <div>
                      <span class="submenu-text-title">About Smart Hub</span>
                      <span class="submenu-text-desc">India's developer commerce mission</span>
                    </div>
                  </div>
                </a>
                <a href="index.html#how-it-works" class="submenu-link">
                  <div class="submenu-link-left">
                    <span class="submenu-icon">🔐</span>
                    <div>
                      <span class="submenu-text-title">Encrypted Key Delivery</span>
                      <span class="submenu-text-desc">How purchases &amp; unlocks work</span>
                    </div>
                  </div>
                </a>
                <a href="index.html#reviews" class="submenu-link">
                  <div class="submenu-link-left">
                    <span class="submenu-icon">⭐</span>
                    <div>
                      <span class="submenu-text-title">Community Testimonials</span>
                      <span class="submenu-text-desc">Reviews from verified creators</span>
                    </div>
                  </div>
                </a>
                <a href="index.html#credits" class="submenu-link">
                  <div class="submenu-link-left">
                    <span class="submenu-icon">👨‍💻</span>
                    <div>
                      <span class="submenu-text-title">Team &amp; Creators</span>
                      <span class="submenu-text-desc">Engineered with ❤️ in India</span>
                    </div>
                  </div>
                </a>
              </div>
            </div>

            <!-- 5. About Platform Section -->
            <a href="index.html#about" class="nav-menu-btn ${activePage === 'about' ? 'active' : ''}">
              <span class="nav-icon-mini">💡</span> About
            </a>

          </nav>

          <!-- Right Strip: Clean Platform Highlights & Quick Settings -->
          <div class="header-ticker-pills">
            <a href="index.html#about" class="ticker-pill ticker-pill-interactive about-pill" title="Learn About Smart Hub Platform">
              <span class="pulse-dot"></span> About Us
            </a>
            <a href="settings.html" class="ticker-pill ticker-pill-interactive" title="Account Settings &amp; Preferences">⚙️ Settings</a>
          </div>

        </div>
      </div>
    </div>

  </header>

  <!-- Mobile Drawer Navigation -->
  <nav class="mobile-nav" id="mobile-nav">
    <div class="mobile-nav-section">
      <div class="mobile-nav-title">Marketplace &amp; Products</div>
      <a href="marketplace.html" class="nav-link">📦 All Products Catalog</a>
      <a href="marketplace.html?cat=React" class="nav-link">⚛️ Web Apps &amp; React</a>
      <a href="marketplace.html?cat=Mobile" class="nav-link">📱 Mobile &amp; Flutter</a>
      <a href="marketplace.html?cat=AI/ML" class="nav-link">🤖 AI &amp; Machine Learning</a>
      <a href="marketplace.html?cat=Templates" class="nav-link">🎨 UI Kits &amp; Templates</a>
      <a href="marketplace.html?filter=free" class="nav-link">🎁 Free Starter Assets</a>
      <a href="product-detail.html" class="nav-link">✨ Featured Product Studio</a>
    </div>

    <div class="mobile-nav-section">
      <div class="mobile-nav-title">Ecosystem &amp; Community</div>
      <a href="ecosystem.html" class="nav-link">🌐 Ecosystem Command Hub</a>
      <a href="feed.html" class="nav-link">📰 Developer Feed</a>
      <a href="community.html" class="nav-link">💬 Community Channels</a>
      <a href="challenges.html" class="nav-link">🏆 Skill Challenges &amp; XP</a>
      <a href="chat.html" class="nav-link">✉️ Direct Messages</a>
    </div>

    <div class="mobile-nav-section">
      <div class="mobile-nav-title">Company &amp; Platform</div>
      <a href="index.html#about" class="nav-link">💡 About Smart Hub</a>
      <a href="settings.html" class="nav-link">⚙️ Account Settings</a>
      <a href="profile.html" class="nav-link">👤 Profile &amp; Portfolio</a>
    </div>

    <div class="mobile-nav-section">
      <div class="mobile-nav-title">Account &amp; Services</div>
      ${isLoggedIn ? `
      <a href="profile.html" class="nav-link">👤 Developer Profile (${user.name})</a>
      <a href="settings.html" class="nav-link">⚙️ Account Settings &amp; Preferences</a>
      <a href="wallet.html" class="nav-link">💰 Rupee Wallet (₹${(user.walletBalance || 0).toLocaleString('en-IN')})</a>
      <a href="seller-dashboard.html" class="nav-link">🚀 Creator &amp; Seller Studio</a>
      ` : `
      <a href="login.html" class="nav-link">🔑 Log In to Smart Hub</a>
      <a href="register.html" class="nav-link">🚀 Create New Account</a>
      <a href="settings.html" class="nav-link">⚙️ Preferences</a>
      `}
      <a href="checkout.html" class="nav-link">🔐 Encrypted Checkout Hub</a>
    </div>
  </nav>

  <!-- React Mount Containers -->
  <div id="react-cart-root"></div>
  <div id="react-spotlight-root"></div>
  `;
}

function renderFooter() {
  return `
  <footer class="footer">
    <div class="container">
      <!-- Trust Strip -->
      <div class="footer-trust-strip">
        <div class="trust-badge-item">
          <span>⚡</span>
          <div>
            <div style="font-weight:700;">Instant Key Delivery</div>
            <div style="font-size:0.72rem;color:var(--text-muted);">Encrypted tokens sent directly to your email</div>
          </div>
        </div>
        <div class="trust-badge-item">
          <span>🛡️</span>
          <div>
            <div style="font-weight:700;">Audited Codebases</div>
            <div style="font-size:0.72rem;color:var(--text-muted);">Strict security &amp; malware verification</div>
          </div>
        </div>
        <div class="trust-badge-item">
          <span>💰</span>
          <div>
            <div style="font-weight:700;">Rupee Wallet (0% Deposit)</div>
            <div style="font-size:0.72rem;color:var(--text-muted);">Instant UPI &amp; Net Banking in ₹ INR</div>
          </div>
        </div>
        <div class="trust-badge-item">
          <span>🤝</span>
          <div>
            <div style="font-weight:700;">Active Community</div>
            <div style="font-size:0.72rem;color:var(--text-muted);">Verified Indian developers &amp; creators</div>
          </div>
        </div>
      </div>

      <div class="footer-grid">
        <!-- Brand Column -->
        <div class="footer-brand">
          <a href="index.html" class="brand-outline-logo" title="Smart Hub — Home">
            <span class="logo-smart">smart</span><span class="logo-dot">.</span><span class="logo-hub">hub</span>
          </a>
          <p>India's premier marketplace for production-ready digital products — Web apps, Flutter kits, AI tools, and UI kits. Built for developers, by developers. 🇮🇳</p>
          <div class="footer-social">
            <a class="social-btn" href="https://x.com" target="_blank" rel="noopener noreferrer" title="Smart Hub on 𝕏 / Twitter" aria-label="Twitter">𝕏</a>
            <a class="social-btn" href="https://linkedin.com" target="_blank" rel="noopener noreferrer" title="Smart Hub on LinkedIn" aria-label="LinkedIn">in</a>
            <a class="social-btn" href="https://github.com" target="_blank" rel="noopener noreferrer" title="Smart Hub on GitHub" aria-label="GitHub">⌥</a>
            <a class="social-btn" href="https://instagram.com" target="_blank" rel="noopener noreferrer" title="Smart Hub on Instagram" aria-label="Instagram">📷</a>
            <a class="social-btn" href="https://youtube.com" target="_blank" rel="noopener noreferrer" title="Smart Hub on YouTube" aria-label="YouTube">▶</a>
          </div>
        </div>

        <!-- Explore -->
        <div class="footer-col">
          <h5>Marketplace</h5>
          <div class="footer-links">
            <a href="marketplace.html">All Products</a>
            <a href="product-detail.html">Featured Product Studio</a>
            <a href="marketplace.html?cat=React">React &amp; Next.js</a>
            <a href="marketplace.html?cat=Mobile">Flutter &amp; Mobile</a>
            <a href="marketplace.html?cat=AI/ML">AI &amp; Python Tools</a>
            <a href="marketplace.html?cat=Templates">UI Kits &amp; Templates</a>
            <a href="marketplace.html?filter=free">Free Starter Codes</a>
          </div>
        </div>

        <!-- Community -->
        <div class="footer-col">
          <h5>Ecosystem</h5>
          <div class="footer-links">
            <a href="ecosystem.html">Ecosystem Command Hub</a>
            <a href="community.html">Community Channels</a>
            <a href="feed.html">Developer Feed</a>
            <a href="challenges.html">Skill Challenges</a>
            <a href="chat.html">Direct Messages</a>
            <a href="challenges.html#leaderboard">Hall of Fame</a>
          </div>
        </div>

        <!-- Sellers -->
        <div class="footer-col">
          <h5>Monetize</h5>
          <div class="footer-links">
            <a href="seller-dashboard.html">Creator &amp; Seller Studio</a>
            <a href="seller-dashboard.html#publish">List Digital Assets</a>
            <a href="wallet.html">Developer Rupee Wallet</a>
            <a href="checkout.html">Encrypted Checkout Hub</a>
            <a href="profile.html">Developer Portfolio</a>
          </div>
        </div>

        <!-- Company -->
        <div class="footer-col">
          <h5>Company</h5>
          <div class="footer-links">
            <a href="index.html#about">About Smart Hub</a>
            <a href="index.html#how-it-works">How It Works</a>
            <a href="index.html#reviews">Customer Reviews</a>
            <a href="index.html#credits">Meet the Team</a>
            <a href="login.html">Account Sign In</a>
          </div>
        </div>
      </div>

      <div class="footer-bottom">
        <div>© 2026 Smart Hub Technologies Pvt. Ltd. All rights reserved. 🇮🇳 Engineered in India.</div>
        <div class="footer-bottom-links">
          <a href="policies.html?tab=privacy">Privacy Policy</a>
          <a href="policies.html?tab=terms">Terms of Service</a>
          <a href="policies.html?tab=refund">Refund Policy</a>
          <a href="policies.html?tab=security">Security Guidelines</a>
        </div>
      </div>
    </div>
  </footer>

  <!-- Toast Container -->
  <div class="toast-container" id="toast-container"></div>
  `;
}

// Global Injector & Theme Initializer
document.addEventListener('DOMContentLoaded', () => {
  // Apply saved theme preference
  const savedTheme = localStorage.getItem('smarthub_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  if (savedTheme === 'light') {
    document.body.classList.add('theme-light');
  } else {
    document.body.classList.remove('theme-light');
  }

  const headerEl = document.getElementById('page-header');
  const footerEl = document.getElementById('page-footer');
  const activePage = window.location.pathname.split('/').pop() || 'index.html';
  if (headerEl) {
    headerEl.innerHTML = renderHeader(activePage);
    // Bind interactive header widgets immediately after rendering
    if (typeof window.initUserDropdown === 'function') window.initUserDropdown();
    if (typeof window.initGlobalSearch === 'function') window.initGlobalSearch();
    if (typeof window.initThemeToggle === 'function') window.initThemeToggle();
    if (typeof window.initMobileMenu === 'function') window.initMobileMenu();
  }
  if (footerEl) footerEl.innerHTML = renderFooter();

  // Attach Signout Handler
  const signoutBtn = document.getElementById('header-signout-btn');
  if (signoutBtn) {
    signoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      localStorage.removeItem('smarthub_user');
      localStorage.removeItem('smarthub_token');
      window.location.href = 'login.html';
    });
  }

  // Load React engine if not already loaded
  if (!window.React || !window.ReactDOM) {
    const r1 = document.createElement('script');
    r1.src = 'https://unpkg.com/react@18/umd/react.production.min.js';
    r1.crossOrigin = 'anonymous';
    r1.onload = () => {
      const r2 = document.createElement('script');
      r2.src = 'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js';
      r2.crossOrigin = 'anonymous';
      r2.onload = () => {
        if (!document.querySelector('script[src*="react-components.js"]')) {
          const r3 = document.createElement('script');
          r3.src = 'js/react-components.js';
          document.body.appendChild(r3);
        }
      };
      document.head.appendChild(r2);
    };
    document.head.appendChild(r1);
  } else if (!document.querySelector('script[src*="react-components.js"]')) {
    const r3 = document.createElement('script');
    r3.src = 'js/react-components.js';
    document.body.appendChild(r3);
  }
});

// ── Global Policy Controller (Opens dedicated standalone policy page) ──
window.openPolicyModal = function(tab = 'privacy') {
  window.location.href = `policies.html?tab=${tab}`;
};
window.closePolicyModal = function() {};
window.switchPolicyTab = function() {};

