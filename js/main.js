// ============================================================
// SMART HUB — Core JavaScript Utilities & Interactive Engine
// ============================================================

// ── Active User State (Syncs with LocalStorage) ────────────
function getCurrentUser() {
  try {
    const saved = localStorage.getItem('smarthub_user');
    if (saved) {
      const u = JSON.parse(saved);
      if (u && (u.isLoggedIn || u.id)) {
        return u;
      }
    }
  } catch (e) {}
  return null;
}

const currentUser = getCurrentUser();

// ── Toast Notifications ────────────────────────────────────
function showToast(message, type = 'info', duration = 3500) {
  const container = document.getElementById('toast-container') || createToastContainer();
  const toast = document.createElement('div');
  const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

function createToastContainer() {
  let div = document.getElementById('toast-container');
  if (!div) {
    div = document.createElement('div');
    div.id = 'toast-container';
    div.className = 'toast-container';
    document.body.appendChild(div);
  }
  return div;
}

// ── Format Currency ────────────────────────────────────────
function formatINR(amount) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
}

// ── Format Numbers ─────────────────────────────────────────
function formatNum(n) {
  if (n >= 1e7) return (n / 1e7).toFixed(1) + 'Cr';
  if (n >= 1e5) return (n / 1e5).toFixed(1) + 'L';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k';
  return n;
}

// ── Relative Time ──────────────────────────────────────────
function relativeTime(date) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

// ── Header Scroll Effect ───────────────────────────────────
function initHeader() {
  const header = document.querySelector('.header');
  if (!header) return;
  window.addEventListener('scroll', () => {
    header.classList.toggle('scrolled', window.scrollY > 15);
  });
}

// ── Mobile Menu ────────────────────────────────────────────
function initMobileMenu() {
  const hamburger = document.getElementById('hamburger');
  const mobileNav = document.getElementById('mobile-nav');
  if (!hamburger || !mobileNav) return;
  hamburger.addEventListener('click', () => {
    hamburger.classList.toggle('active');
    mobileNav.classList.toggle('active');
  });
}

// ── User Dropdown (Smooth Hover with Grace Timer & Click Support) ───
function initUserDropdown() {
  const userMenu = document.querySelector('.user-menu');
  if (!userMenu) return;
  if (userMenu.dataset.dropdownReady === 'true') return;
  userMenu.dataset.dropdownReady = 'true';

  const toggleBtn = userMenu.querySelector('.user-dropdown-toggle');
  const menu = userMenu.querySelector('.dropdown-menu');
  if (!menu) return;

  let closeTimer = null;

  function showMenu() {
    if (closeTimer) {
      clearTimeout(closeTimer);
      closeTimer = null;
    }
    menu.classList.add('active');
    userMenu.classList.add('open');
  }

  function hideMenuDelayed() {
    if (closeTimer) clearTimeout(closeTimer);
    // 350ms grace timer ensures cursor transitioning from button to menu never dismisses options
    closeTimer = setTimeout(() => {
      menu.classList.remove('active');
      userMenu.classList.remove('open');
    }, 350);
  }

  // Mouse hover listeners on both trigger wrap and dropdown menu
  userMenu.addEventListener('mouseenter', showMenu);
  userMenu.addEventListener('mouseleave', hideMenuDelayed);
  menu.addEventListener('mouseenter', showMenu);
  menu.addEventListener('mouseleave', hideMenuDelayed);

  // Click toggle support for the chevron button
  if (toggleBtn) {
    toggleBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (menu.classList.contains('active')) {
        menu.classList.remove('active');
        userMenu.classList.remove('open');
      } else {
        showMenu();
      }
    });
  }

  // Dismiss on outside click
  document.addEventListener('click', (e) => {
    if (!userMenu.contains(e.target)) {
      if (closeTimer) clearTimeout(closeTimer);
      menu.classList.remove('active');
      userMenu.classList.remove('open');
    }
  });

  // Sign out button
  const signOutBtn = document.getElementById('header-signout-btn');
  if (signOutBtn) {
    signOutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const user = getCurrentUser();
      user.isLoggedIn = false;
      localStorage.setItem('smarthub_user', JSON.stringify(user));
      showToast('Signed out of Smart Hub', 'info');
      setTimeout(() => { window.location.reload(); }, 600);
    });
  }
}
window.initUserDropdown = initUserDropdown;

// ── Theme Switcher (Dark Outline vs Light Linen Cream) ─────
function initThemeToggle() {
  const toggleBtn = document.getElementById('theme-toggle-btn');
  if (!toggleBtn) return;

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    if (theme === 'light') {
      document.body.classList.add('theme-light');
      toggleBtn.textContent = '🌙';
      toggleBtn.setAttribute('title', 'Switch to Dark Mode');
    } else {
      document.body.classList.remove('theme-light');
      toggleBtn.textContent = '☀️';
      toggleBtn.setAttribute('title', 'Switch to Light Theme (Pale Pink & Purple)');
    }
    localStorage.setItem('smarthub_theme', theme);
  }

  const current = localStorage.getItem('smarthub_theme') || 'dark';
  applyTheme(current);

  toggleBtn.addEventListener('click', () => {
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    const next = isLight ? 'dark' : 'light';
    applyTheme(next);
    showToast(`Switched to ${next === 'light' ? 'Light Theme (Pale Pink & Purple)' : 'Dark'} theme`, 'info');
  });
}

// ── Top Bar Search Engine (Interactive Autocomplete) ───────
function initGlobalSearch() {
  const input = document.getElementById('global-search-input');
  const dropdown = document.getElementById('global-search-dropdown');
  const resultsContainer = document.getElementById('global-search-results');
  const clearBtn = document.getElementById('global-search-clear');
  const viewAllBtn = document.getElementById('global-search-view-all');
  if (!input || !dropdown || !resultsContainer) return;

  let currentTab = 'all';

  // Site pages for search index
  const sitePages = [
    { title: 'Marketplace — All Digital Products', cat: 'Page', url: 'marketplace.html', icon: '🛒' },
    { title: 'Coding Challenges & XP System', cat: 'Page', url: 'challenges.html', icon: '🏆' },
    { title: 'Developer Feed & Tech Blog', cat: 'Page', url: 'feed.html', icon: '📰' },
    { title: 'Community Discord Channels', cat: 'Page', url: 'community.html', icon: '💬' },
    { title: 'Rupee Wallet & Instant UPI', cat: 'Page', url: 'wallet.html', icon: '💰' },
    { title: 'Developer Portfolio & Profile', cat: 'Page', url: 'profile.html', icon: '👤' },
    { title: 'Account Settings & Preferences', cat: 'Settings', url: 'settings.html', icon: '⚙️' },
    { title: 'Member Sign In & Authentication', cat: 'Auth', url: 'login.html', icon: '🔑' },
    { title: 'Creator & Buyer Registration', cat: 'Auth', url: 'register.html', icon: '🚀' },
    { title: 'Leaderboard & Top Challengers', cat: 'Challenges', url: 'challenges.html#leaderboard', icon: '🥇' },
    { title: 'Instant Encrypted Key Delivery', cat: 'Security', url: 'index.html#how-it-works', icon: '🔐' },
  ];

  function performSearch(query) {
    const q = query.trim().toLowerCase();
    if (!q) {
      dropdown.classList.remove('active');
      if (clearBtn) clearBtn.classList.remove('active');
      return;
    }
    if (clearBtn) clearBtn.classList.add('active');

    const products = (typeof SmartHubData !== 'undefined' && SmartHubData.products) ? SmartHubData.products : [];

    // Filter products
    const matchedProducts = products.filter(p =>
      p.title.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q) ||
      (p.tags && p.tags.some(t => t.toLowerCase().includes(q))) ||
      (p.description && p.description.toLowerCase().includes(q))
    );

    // Filter pages
    const matchedPages = sitePages.filter(p =>
      p.title.toLowerCase().includes(q) ||
      p.cat.toLowerCase().includes(q)
    );

    let html = '';

    if (currentTab === 'all' || currentTab === 'products') {
      matchedProducts.forEach(p => {
        html += `
          <a href="marketplace.html?id=${p.id}" class="search-item">
            <img src="${p.thumb}" alt="${p.title}" class="search-item-thumb">
            <div class="search-item-info">
              <div class="search-item-title">${p.title}</div>
              <div class="search-item-meta">
                <span>[ ${p.category} ]</span>
                <span>★ ${p.rating}</span>
                <span>• by ${p.author.name}</span>
              </div>
            </div>
            <div class="search-item-price">₹${p.price.toLocaleString('en-IN')}</div>
          </a>
        `;
      });
    }

    if (currentTab === 'all' || currentTab === 'pages') {
      matchedPages.forEach(page => {
        html += `
          <a href="${page.url}" class="search-item">
            <div style="font-size:1.4rem;width:44px;text-align:center;">${page.icon}</div>
            <div class="search-item-info">
              <div class="search-item-title">${page.title}</div>
              <div class="search-item-meta">
                <span>[ ${page.cat} ]</span>
                <span>Jump to page →</span>
              </div>
            </div>
          </a>
        `;
      });
    }

    if (!html) {
      html = `
        <div style="text-align:center;padding:24px 12px;color:var(--text-muted);">
          <div style="font-size:1.8rem;margin-bottom:6px;">🔍</div>
          <div style="font-size:0.85rem;font-weight:600;">No exact matches found for "${query}"</div>
          <div style="font-size:0.75rem;margin-top:4px;">Try searching "React", "AI", "Flutter", or "Wallet"</div>
        </div>
      `;
    }

    resultsContainer.innerHTML = html;
    if (viewAllBtn) {
      viewAllBtn.href = `marketplace.html?q=${encodeURIComponent(query)}`;
      viewAllBtn.textContent = `Search All "${query}" in Catalog →`;
    }
    dropdown.classList.add('active');
  }

  input.addEventListener('input', (e) => performSearch(e.target.value));
  input.addEventListener('focus', () => {
    if (input.value.trim()) performSearch(input.value);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const q = input.value.trim();
      if (q) {
        window.location.href = `marketplace.html?q=${encodeURIComponent(q)}`;
      }
    } else if (e.key === 'Escape') {
      dropdown.classList.remove('active');
      input.blur();
    }
  });

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      input.value = '';
      clearBtn.classList.remove('active');
      dropdown.classList.remove('active');
      input.focus();
    });
  }

  // Filter tab buttons
  document.querySelectorAll('.search-tab-pill').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      document.querySelectorAll('.search-tab-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentTab = btn.dataset.searchFilter;
      performSearch(input.value);
    });
  });

  // Global Keyboard shortcut: '/' or 'Ctrl+K' / 'Cmd+K'
  document.addEventListener('keydown', (e) => {
    if ((e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') ||
        ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k')) {
      e.preventDefault();
      input.focus();
      input.select();
    }
  });

  // Close dropdown on click outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.topbar-search-wrap')) {
      dropdown.classList.remove('active');
    }
  });
}

// ── Scroll Animations ──────────────────────────────────────
function initScrollAnimations() {
  const els = document.querySelectorAll('[data-animate]');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('animate-fadeInUp');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });
  els.forEach((el) => observer.observe(el));
}

// ── Tabs ───────────────────────────────────────────────────
function initTabs(containerSelector) {
  const containers = document.querySelectorAll(containerSelector || '[data-tabs]');
  containers.forEach((container) => {
    const tabs = container.querySelectorAll('.tab');
    const panels = container.querySelectorAll('[data-panel]');
    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const target = tab.dataset.tab;
        panels.forEach(p => p.classList.toggle('hidden', p.dataset.panel !== target));
      });
    });
  });
}

// ── Modal ──────────────────────────────────────────────────
function openModal(id) {
  const overlay = document.getElementById(id);
  if (overlay) overlay.classList.add('active');
}
function closeModal(id) {
  const overlay = document.getElementById(id);
  if (overlay) overlay.classList.remove('active');
}
function initModals() {
  document.querySelectorAll('[data-open-modal]').forEach(btn => {
    btn.addEventListener('click', () => openModal(btn.dataset.openModal));
  });
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.classList.remove('active');
    });
  });
  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.closest('.modal-overlay').classList.remove('active');
    });
  });
}

// ── Wishlist Toggle ────────────────────────────────────────
function initWishlist() {
  document.querySelectorAll('.product-card-wishlist').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      btn.classList.toggle('active');
      const icon = btn.querySelector('span') || btn;
      if (btn.classList.contains('active')) {
        icon.textContent = '♥';
        showToast('Added to wishlist!', 'success');
      } else {
        icon.textContent = '♡';
        showToast('Removed from wishlist', 'info');
      }
    });
  });
}

// ── Counter Animations ─────────────────────────────────────
function animateCounter(el, target, duration = 2000) {
  let start = 0;
  const step = Math.max(1, target / (duration / 16));
  const prefix = el.dataset.prefix || '';
  const suffix = el.dataset.suffix || '';
  const timer = setInterval(() => {
    start += step;
    if (start >= target) {
      el.textContent = prefix + formatNum(target) + suffix;
      clearInterval(timer);
    } else {
      el.textContent = prefix + formatNum(Math.floor(start)) + suffix;
    }
  }, 16);
}

function initCounters() {
  const counters = document.querySelectorAll('[data-counter]');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        animateCounter(el, parseInt(el.dataset.counter));
        observer.unobserve(el);
      }
    });
  }, { threshold: 0.5 });
  counters.forEach(el => observer.observe(el));
}

// ── Active Nav Link ────────────────────────────────────────
function setActiveNav() {
  const path = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-link, .nav-menu-btn, .mobile-nav .nav-link').forEach(link => {
    const href = link.getAttribute('href') || '';
    if (href && (href === path || path.startsWith(href.replace('.html', '')))) {
      link.classList.add('active');
    }
  });
}

// ── Progress Bars ──────────────────────────────────────────
function initProgressBars() {
  const bars = document.querySelectorAll('.progress-fill[data-progress]');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.width = entry.target.dataset.progress + '%';
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });
  bars.forEach(bar => { bar.style.width = '0%'; observer.observe(bar); });
}

// ── Document Ready ─────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initHeader();
  initMobileMenu();
  initUserDropdown();
  initThemeToggle();
  initGlobalSearch();
  initScrollAnimations();
  initTabs();
  initModals();
  initWishlist();
  initCounters();
  initProgressBars();
  setActiveNav();

  // Update wallet display globally
  const user = getCurrentUser();
  const walletDisplays = document.querySelectorAll('.wallet-display');
  walletDisplays.forEach(el => {
    el.textContent = formatINR((user && user.walletBalance !== undefined) ? user.walletBalance : 0);
  });
});

// ── Expose globals ─────────────────────────────────────────
window.initGlobalSearch = initGlobalSearch;
window.initThemeToggle = initThemeToggle;
window.initMobileMenu = initMobileMenu;
window.SH = {
  showToast,
  formatINR,
  formatNum,
  openModal,
  closeModal,
  currentUser: getCurrentUser(),
};
