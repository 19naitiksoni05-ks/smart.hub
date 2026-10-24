// ============================================================
// SMART HUB — Client Backend API Bridge & Real-Time Gateway
// Connects UI cleanly to the Express REST API and WebSocket
// ============================================================

(function () {
  'use strict';

  // Determine API base URL
  const isServerHost = window.location.port === '5000' || window.location.port === '3000';
  const API_BASE = isServerHost ? '/api' : 'http://localhost:5000/api';
  const WS_URL = isServerHost 
    ? (window.location.protocol === 'https:' ? 'wss://' : 'ws://') + window.location.host 
    : 'ws://localhost:5000';

  const SmartHubAPI = {
    baseUrl: API_BASE,
    wsUrl: WS_URL,
    ws: null,
    isOnline: false,

    // ── Health Check ──────────────────────────────────────────
    async checkHealth() {
      try {
        const res = await fetch(`${this.baseUrl}/health`, { signal: AbortSignal.timeout(1200) });
        if (res.ok) {
          const data = await res.json();
          this.isOnline = true;
          return data;
        }
      } catch (e) {
        this.isOnline = false;
      }
      return null;
    },

    async getStats() {
      try {
        const res = await fetch(`${this.baseUrl}/stats`, { signal: AbortSignal.timeout(2000) });
        if (res.ok) {
          return await res.json();
        }
      } catch (e) {}
      return null;
    },

    // ── Headers with Auth Token ───────────────────────────────
    getHeaders(contentType = 'application/json') {
      const headers = {};
      if (contentType) headers['Content-Type'] = contentType;
      const token = localStorage.getItem('smarthub_token');
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const user = localStorage.getItem('smarthub_user');
      if (user) {
        try {
          const u = JSON.parse(user);
          if (u.id) headers['x-user-id'] = u.id;
        } catch (e) {}
      }
      return headers;
    },

    // ── Authentication ────────────────────────────────────────
    async register(name, username, email, password, role = 'buyer') {
      try {
        const res = await fetch(`${this.baseUrl}/auth/register`, {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({ name, username, email, password, role })
        });
        const data = await res.json();
        if (data.success && data.token) {
          localStorage.setItem('smarthub_token', data.token);
          localStorage.setItem('smarthub_user', JSON.stringify({ ...data.user, isLoggedIn: true }));
        }
        return data;
      } catch (err) {
        return { success: false, error: err.message };
      }
    },

    async login(identity, password) {
      try {
        const res = await fetch(`${this.baseUrl}/auth/login`, {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({ identity, password })
        });
        const data = await res.json();
        if (data.success && data.token) {
          localStorage.setItem('smarthub_token', data.token);
          localStorage.setItem('smarthub_user', JSON.stringify({ ...data.user, isLoggedIn: true }));
        }
        return data;
      } catch (err) {
        return { success: false, error: err.message };
      }
    },

    async getMe() {
      try {
        const res = await fetch(`${this.baseUrl}/auth/me`, { headers: this.getHeaders() });
        const data = await res.json();
        if (data.success && data.user) {
          localStorage.setItem('smarthub_user', JSON.stringify({ ...data.user, isLoggedIn: true }));
        }
        return data;
      } catch (err) {
        return null;
      }
    },

    logout() {
      localStorage.removeItem('smarthub_token');
      localStorage.removeItem('smarthub_user');
      window.location.href = 'login.html';
    },

    // ── Products & Marketplace ────────────────────────────────
    async getProducts(params = {}) {
      try {
        const query = new URLSearchParams(params).toString();
        const res = await fetch(`${this.baseUrl}/products?${query}`);
        const data = await res.json();
        if (data.success && Array.isArray(data.products)) {
          // Sync with local SmartHubData
          if (window.SmartHubData) {
            window.SmartHubData.products = data.products;
          }
          return data.products;
        }
      } catch (err) {
        console.warn('API getProducts fallback to local:', err);
      }
      return (window.SmartHubData && window.SmartHubData.products) || [];
    },

    async getProduct(id) {
      try {
        const res = await fetch(`${this.baseUrl}/products/${id}`);
        const data = await res.json();
        if (data.success) return data;
      } catch (err) {}
      if (window.SmartHubData && window.SmartHubData.products) {
        const p = window.SmartHubData.products.find(item => item.id === id);
        return { success: true, product: p, reviews: [], related: [] };
      }
      return null;
    },

    async createProduct(productData) {
      try {
        const res = await fetch(`${this.baseUrl}/products`, {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify(productData)
        });
        return await res.json();
      } catch (err) {
        return { success: false, error: err.message };
      }
    },

    async addReview(productId, rating, text) {
      try {
        const res = await fetch(`${this.baseUrl}/products/${productId}/reviews`, {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({ rating, text })
        });
        return await res.json();
      } catch (err) {
        return { success: false, error: err.message };
      }
    },

    // ── Orders & Checkout ─────────────────────────────────────
    async executeCheckout(orderData) {
      try {
        const res = await fetch(`${this.baseUrl}/orders/checkout`, {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify(orderData)
        });
        const data = await res.json();
        if (data.success && data.updatedWalletBalance !== undefined) {
          const user = JSON.parse(localStorage.getItem('smarthub_user') || '{}');
          user.walletBalance = data.updatedWalletBalance;
          localStorage.setItem('smarthub_user', JSON.stringify(user));
          // Update UI balance
          document.querySelectorAll('.wallet-display').forEach(el => {
            el.textContent = '₹' + data.updatedWalletBalance.toLocaleString('en-IN');
          });
        }
        return data;
      } catch (err) {
        return { success: false, error: err.message };
      }
    },

    async getMyOrders() {
      try {
        const res = await fetch(`${this.baseUrl}/orders/my-orders`, { headers: this.getHeaders() });
        return await res.json();
      } catch (err) {
        return { success: false, orders: [] };
      }
    },

    async verifyKey(key) {
      try {
        const res = await fetch(`${this.baseUrl}/orders/verify-key/${encodeURIComponent(key)}`);
        return await res.json();
      } catch (err) {
        return { success: false, valid: false };
      }
    },

    async requestSampleToken(projectId = '') {
      try {
        const url = `${this.baseUrl}/orders/sample-token${projectId ? `?productId=${encodeURIComponent(projectId)}` : ''}`;
        const res = await fetch(url);
        return await res.json();
      } catch (err) {
        return { success: false };
      }
    },

    // ── Wallet ────────────────────────────────────────────────
    async getWallet() {
      try {
        const res = await fetch(`${this.baseUrl}/wallet`, { headers: this.getHeaders() });
        const data = await res.json();
        if (data.success && data.wallet) {
          const user = JSON.parse(localStorage.getItem('smarthub_user') || '{}');
          user.walletBalance = data.wallet.balance;
          localStorage.setItem('smarthub_user', JSON.stringify(user));
          if (window.SmartHubData) {
            window.SmartHubData.transactions = data.transactions;
          }
          return data;
        }
      } catch (err) {}
      return null;
    },

    async topupWallet(amount, method = 'UPI') {
      try {
        const res = await fetch(`${this.baseUrl}/wallet/topup`, {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({ amount, method })
        });
        const data = await res.json();
        if (data.success) {
          const user = JSON.parse(localStorage.getItem('smarthub_user') || '{}');
          user.walletBalance = data.newBalance;
          localStorage.setItem('smarthub_user', JSON.stringify(user));
          document.querySelectorAll('.wallet-display').forEach(el => {
            el.textContent = '₹' + data.newBalance.toLocaleString('en-IN');
          });
        }
        return data;
      } catch (err) {
        return { success: false, error: err.message };
      }
    },

    async transferWallet(recipient, amount) {
      try {
        const res = await fetch(`${this.baseUrl}/wallet/transfer`, {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({ recipient, amount })
        });
        return await res.json();
      } catch (err) {
        return { success: false, error: err.message };
      }
    },

    async withdrawWallet(amount, upiId) {
      try {
        const res = await fetch(`${this.baseUrl}/wallet/withdraw`, {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({ amount, upiId })
        });
        return await res.json();
      } catch (err) {
        return { success: false, error: err.message };
      }
    },

    // ── Social Feed ───────────────────────────────────────────
    async getFeedPosts() {
      try {
        const res = await fetch(`${this.baseUrl}/feed/posts`);
        const data = await res.json();
        if (data.success && window.SmartHubData) {
          window.SmartHubData.posts = data.posts;
        }
        return data;
      } catch (err) {
        return { success: false, posts: (window.SmartHubData && window.SmartHubData.posts) || [] };
      }
    },

    async createPost(content, tags, image) {
      try {
        const res = await fetch(`${this.baseUrl}/feed/posts`, {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({ content, tags, image })
        });
        return await res.json();
      } catch (err) {
        return { success: false, error: err.message };
      }
    },

    async likePost(postId) {
      try {
        const res = await fetch(`${this.baseUrl}/feed/posts/${postId}/like`, {
          method: 'POST',
          headers: this.getHeaders()
        });
        return await res.json();
      } catch (err) {
        return { success: false };
      }
    },

    async commentPost(postId, text) {
      try {
        const res = await fetch(`${this.baseUrl}/feed/posts/${postId}/comments`, {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({ text })
        });
        return await res.json();
      } catch (err) {
        return { success: false, error: err.message };
      }
    },

    // ── Chat & Direct Messages ────────────────────────────────
    async getConversations() {
      try {
        const res = await fetch(`${this.baseUrl}/chat/conversations`);
        return await res.json();
      } catch (err) {
        return { success: false, conversations: [] };
      }
    },

    async getChatMessages(convId) {
      try {
        const res = await fetch(`${this.baseUrl}/chat/messages/${convId}`);
        return await res.json();
      } catch (err) {
        return { success: false, messages: (window.SmartHubData && window.SmartHubData.messages) || [] };
      }
    },

    async sendChatMessage(conversationId, text, attachment) {
      try {
        const res = await fetch(`${this.baseUrl}/chat/messages`, {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({ conversationId, text, attachment })
        });
        return await res.json();
      } catch (err) {
        return { success: false, error: err.message };
      }
    },

    // ── Community Channels ────────────────────────────────────
    async getChannels() {
      try {
        const res = await fetch(`${this.baseUrl}/community/channels`);
        const data = await res.json();
        if (data.success && window.SmartHubData) {
          window.SmartHubData.channels = data.channels;
        }
        return data;
      } catch (err) {
        return { success: false, channels: (window.SmartHubData && window.SmartHubData.channels) || [] };
      }
    },

    async getChannelMessages(channelId) {
      try {
        const res = await fetch(`${this.baseUrl}/community/channels/${channelId}/messages`);
        return await res.json();
      } catch (err) {
        return { success: false, messages: [] };
      }
    },

    async sendChannelMessage(channelId, text) {
      try {
        const res = await fetch(`${this.baseUrl}/community/channels/${channelId}/messages`, {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({ text })
        });
        return await res.json();
      } catch (err) {
        return { success: false, error: err.message };
      }
    },

    // ── Challenges & Leaderboard ──────────────────────────────
    async getChallenges() {
      try {
        const res = await fetch(`${this.baseUrl}/challenges`);
        const data = await res.json();
        if (data.success && window.SmartHubData) {
          window.SmartHubData.challenges = data.challenges;
        }
        return data;
      } catch (err) {
        return { success: false, challenges: (window.SmartHubData && window.SmartHubData.challenges) || [] };
      }
    },

    async getLeaderboard() {
      try {
        const res = await fetch(`${this.baseUrl}/challenges/leaderboard`);
        const data = await res.json();
        if (data.success && window.SmartHubData) {
          window.SmartHubData.leaderboard = data.leaderboard;
        }
        return data;
      } catch (err) {
        return { success: false, leaderboard: (window.SmartHubData && window.SmartHubData.leaderboard) || [] };
      }
    },

    async submitChallenge(id, code) {
      try {
        const res = await fetch(`${this.baseUrl}/challenges/${id}/submit`, {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({ code })
        });
        return await res.json();
      } catch (err) {
        return { success: false, error: err.message };
      }
    },

    // ── Creator / Seller Studio ───────────────────────────────
    async getSellerStats() {
      try {
        const res = await fetch(`${this.baseUrl}/seller/stats`, { headers: this.getHeaders() });
        return await res.json();
      } catch (err) {
        return { success: false };
      }
    },

    // ── Real-Time WebSocket Gateway ───────────────────────────
    initWebSocket(onMessageCallback) {
      try {
        if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
          return;
        }
        this.ws = new WebSocket(this.wsUrl);
        this.ws.onopen = () => {
          console.log('⚡ SmartHub WebSocket connected');
        };
        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (typeof onMessageCallback === 'function') {
              onMessageCallback(data);
            }
            window.dispatchEvent(new CustomEvent('smarthub-ws-message', { detail: data }));
          } catch (e) {}
        };
        this.ws.onerror = () => {
          // Silent fallback
        };
      } catch (e) {}
    },

    // ── Auto Bootstrap Application ────────────────────────────
    async bootstrap() {
      try {
        const health = await this.checkHealth();
        if (health) {
          console.log(`%c[SmartHub Backend] Connected to ${this.baseUrl} 🚀`, 'color:#22c55e;font-weight:bold;');
          const res = await fetch(`${this.baseUrl}/bootstrap`);
          if (res.ok) {
            const data = await res.json();
            if (data.success && window.SmartHubData) {
              if (data.products) window.SmartHubData.products = data.products;
              if (data.categories) window.SmartHubData.categories = data.categories;
              if (data.reviews) window.SmartHubData.reviews = data.reviews;
              if (data.leaderboard) window.SmartHubData.leaderboard = data.leaderboard;
              if (data.challenges) window.SmartHubData.challenges = data.challenges;
              if (data.transactions) window.SmartHubData.transactions = data.transactions;
            }
          }
          // Init WS
          this.initWebSocket();
        } else {
          console.log('%c[SmartHub Backend] Running in Local Storage Mode (Offline)', 'color:#f59e0b;');
        }
      } catch (e) {}
    }
  };

  // Expose globally
  window.SmartHubAPI = SmartHubAPI;
  window.SH_API = SmartHubAPI;

  // Run initial bootstrap on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => SmartHubAPI.bootstrap());
  } else {
    SmartHubAPI.bootstrap();
  }
})();
