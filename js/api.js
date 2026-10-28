// ============================================================
// SMART HUB — Client Backend API Bridge & Real-Time Gateway
// Connects UI cleanly to the Express REST API and WebSocket
// ============================================================

(function () {
  'use strict';

  // Determine API base URL
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const isLocalExpressPort = isLocalhost && (window.location.port === '5000' || window.location.port === '3000');

  // On Vercel or live domain, always use relative '/api'
  // Only use 'http://localhost:5000/api' if opened from a local secondary server (like Live Server port 5500)
  const API_BASE = (!isLocalhost || isLocalExpressPort) ? '/api' : 'http://localhost:5000/api';
  const WS_URL = !isLocalhost 
    ? (window.location.protocol === 'https:' ? 'wss://' : 'ws://') + window.location.host 
    : (isLocalExpressPort ? (window.location.protocol === 'https:' ? 'wss://' : 'ws://') + window.location.host : 'ws://localhost:5000');

  const SmartHubAPI = {
    baseUrl: API_BASE,
    wsUrl: WS_URL,
    ws: null,
    isOnline: false,

    // ── Safe JSON Parser Helper ───────────────────────────────
    async safeJson(res) {
      if (!res) return { success: false, error: 'No response from server' };
      try {
        const text = await res.text();
        if (!text || !text.trim()) {
          return { success: res.ok, status: res.status };
        }
        try {
          return JSON.parse(text);
        } catch {
          const cleanText = text.replace(/<[^>]*>?/gm, '').trim().slice(0, 150);
          return {
            success: false,
            error: cleanText || `Server responded with HTTP ${res.status}`
          };
        }
      } catch (err) {
        return { success: false, error: err.message || 'Failed to parse response' };
      }
    },

    // ── Health Check ──────────────────────────────────────────
    async checkHealth() {
      try {
        const signal = (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') ? AbortSignal.timeout(5000) : undefined;
        const res = await fetch(`${this.baseUrl}/health`, signal ? { signal } : {});
        if (res.ok) {
          const data = await this.safeJson(res);
          this.isOnline = Boolean(data && data.status === 'ONLINE');
          return data;
        }
      } catch (e) {
        this.isOnline = false;
      }
      return null;
    },

    async getStats() {
      try {
        const signal = (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') ? AbortSignal.timeout(5000) : undefined;
        const res = await fetch(`${this.baseUrl}/stats`, signal ? { signal } : {});
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
          if (u.email) headers['x-user-email'] = u.email;
          if (u.name) headers['x-user-name'] = encodeURIComponent(u.name);
        } catch (e) {}
      }
      return headers;
    },

    getMultipartHeaders() {
      const headers = {};
      const token = localStorage.getItem('smarthub_token');
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const user = localStorage.getItem('smarthub_user');
      if (user) {
        try {
          const u = JSON.parse(user);
          if (u.id) headers['x-user-id'] = u.id;
          if (u.email) headers['x-user-email'] = u.email;
          if (u.name) headers['x-user-name'] = encodeURIComponent(u.name);
        } catch (e) {}
      }
      return headers;
    },

    // ── Media & File Upload Features ──────────────────────────
    async uploadSingle(file) {
      try {
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch(`${this.baseUrl}/upload/single`, {
          method: 'POST',
          headers: this.getMultipartHeaders(),
          body: formData
        });
        return await res.json();
      } catch (err) {
        return { success: false, error: err.message };
      }
    },

    async uploadImage(imageFile) {
      try {
        const formData = new FormData();
        formData.append('image', imageFile);
        const res = await fetch(`${this.baseUrl}/upload/image`, {
          method: 'POST',
          headers: this.getMultipartHeaders(),
          body: formData
        });
        return await res.json();
      } catch (err) {
        return { success: false, error: err.message };
      }
    },

    async uploadVideo(videoFile) {
      try {
        const formData = new FormData();
        formData.append('video', videoFile);
        const res = await fetch(`${this.baseUrl}/upload/video`, {
          method: 'POST',
          headers: this.getMultipartHeaders(),
          body: formData
        });
        return await res.json();
      } catch (err) {
        return { success: false, error: err.message };
      }
    },

    async uploadFiles(fileList) {
      try {
        const formData = new FormData();
        Array.from(fileList).forEach(file => formData.append('files', file));
        const res = await fetch(`${this.baseUrl}/upload/multiple`, {
          method: 'POST',
          headers: this.getMultipartHeaders(),
          body: formData
        });
        return await res.json();
      } catch (err) {
        return { success: false, error: err.message };
      }
    },

    async uploadFolder(fileList, folderName = 'project_folder', relativePaths = []) {
      try {
        if (Array.isArray(folderName)) {
          const tmp = folderName;
          folderName = typeof relativePaths === 'string' ? relativePaths : 'project_folder';
          relativePaths = tmp;
        }
        const formData = new FormData();
        formData.append('folderName', folderName || 'project_folder');
        Array.from(fileList).forEach((file, idx) => {
          formData.append('folderFiles', file);
          if (!relativePaths[idx] && file.webkitRelativePath) {
            relativePaths[idx] = file.webkitRelativePath;
          }
        });
        if (relativePaths && relativePaths.length > 0) {
          formData.append('paths', JSON.stringify(relativePaths));
        }

        const res = await fetch(`${this.baseUrl}/upload/folder`, {
          method: 'POST',
          headers: this.getMultipartHeaders(),
          body: formData
        });
        return await res.json();
      } catch (err) {
        return { success: false, error: err.message };
      }
    },

    async getUploadLibrary(type = '', category = '') {
      try {
        const q = type ? `type=${encodeURIComponent(type)}` : (category ? `category=${encodeURIComponent(category)}` : '');
        const res = await fetch(`${this.baseUrl}/upload/library${q ? '?' + q : ''}`, {
          headers: this.getHeaders()
        });
        return await res.json();
      } catch (err) {
        return { success: false, error: err.message, library: [] };
      }
    },

    async deleteUpload(id) {
      try {
        const res = await fetch(`${this.baseUrl}/upload/${id}`, {
          method: 'DELETE',
          headers: this.getHeaders()
        });
        return await res.json();
      } catch (err) {
        return { success: false, error: err.message };
      }
    },

    // ── Authentication ────────────────────────────────────────
    async register(name, username, email, password, role = 'buyer', mobile = '') {
      try {
        const res = await fetch(`${this.baseUrl}/auth/register`, {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({ name, username, email, password, role, mobile })
        });
        const data = await this.safeJson(res);
        if (data.success && data.token) {
          localStorage.setItem('smarthub_token', data.token);
          localStorage.setItem('smarthub_user', JSON.stringify({ ...data.user, isLoggedIn: true }));
          if (data.apiKey && data.apiKey.rawKey) {
            localStorage.setItem('smarthub_apiKey', data.apiKey.rawKey);
          }
        }
        return data;
      } catch (err) {
        return { success: false, error: err.message };
      }
    },

    async sendOtp(email, mobile) {
      try {
        const res = await fetch(this.baseUrl + '/auth/send-otp', {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({ email, mobile })
        });
        return await this.safeJson(res);
      } catch (err) {
        return { success: false, error: err.message };
      }
    },

    async verifyOtp(email, otp) {
      try {
        const res = await fetch(this.baseUrl + '/auth/verify-otp', {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({ email, otp })
        });
        return await this.safeJson(res);
      } catch (err) {
        return { success: false, error: err.message };
      }
    },

    async loginWithGoogle(payload) {
      try {
        const res = await fetch(this.baseUrl + '/auth/google', {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify(payload)
        });
        const data = await this.safeJson(res);
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
        const data = await this.safeJson(res);
        if (data.success && data.token) {
          localStorage.setItem('smarthub_token', data.token);
          localStorage.setItem('smarthub_user', JSON.stringify({ ...data.user, isLoggedIn: true }));
        }
        return data;
      } catch (err) {
        return { success: false, error: err.message };
      }
    },

    async loginWithGitHub(payload) {
      try {
        const res = await fetch(`${this.baseUrl}/auth/github`, {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify(payload)
        });
        const data = await this.safeJson(res);
        if (data.success && data.token) {
          localStorage.setItem('smarthub_token', data.token);
          localStorage.setItem('smarthub_user', JSON.stringify({ ...data.user, isLoggedIn: true }));
        }
        return data;
      } catch (err) {
        return { success: false, error: err.message };
      }
    },

    async getAuthConfig() {
      try {
        const res = await fetch(`${this.baseUrl}/auth/config`);
        return await res.json();
      } catch (err) {
        return { success: false };
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

    async requestPasswordReset(email) {
      try {
        const res = await fetch(`${this.baseUrl}/auth/forgot-password`, {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({ email })
        });
        return await this.safeJson(res);
      } catch (err) {
        return { success: false, error: err.message };
      }
    },

    async confirmPasswordReset(token, newPassword) {
      try {
        const res = await fetch(`${this.baseUrl}/auth/reset-password`, {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({ token, newPassword })
        });
        return await this.safeJson(res);
      } catch (err) {
        return { success: false, error: err.message };
      }
    },

    async subscribeNewsletter(email) {
      try {
        const res = await fetch(`${this.baseUrl}/newsletter/subscribe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        });
        return await this.safeJson(res);
      } catch (err) {
        return { success: false, error: err.message };
      }
    },

    async resetPassword(emailOrIdentity, newPassword) {
      return this.requestPasswordReset(emailOrIdentity);
    },

    // ── Developer API Keys Management ─────────────────────────
    async getApiKeys() {
      try {
        const res = await fetch(`${this.baseUrl}/auth/api-keys`, { headers: this.getHeaders() });
        return await res.json();
      } catch (err) {
        return { success: false, error: err.message, apiKeys: [] };
      }
    },

    async createApiKey(name = 'New API Key', scope = 'full_access') {
      try {
        const res = await fetch(`${this.baseUrl}/auth/api-keys`, {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({ name, scope })
        });
        return await res.json();
      } catch (err) {
        return { success: false, error: err.message };
      }
    },

    async revokeApiKey(keyId) {
      try {
        const res = await fetch(`${this.baseUrl}/auth/api-keys/${keyId}`, {
          method: 'DELETE',
          headers: this.getHeaders()
        });
        return await res.json();
      } catch (err) {
        return { success: false, error: err.message };
      }
    },

    async revealApiKey(keyId, credentials) {
      try {
        const payload = typeof credentials === 'string' ? { password: credentials } : credentials;
        const res = await fetch(`${this.baseUrl}/auth/api-keys/${keyId}/reveal`, {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify(payload)
        });
        return await res.json();
      } catch (err) {
        return { success: false, error: err.message };
      }
    },

    async requestOtp() {
      try {
        const res = await fetch(`${this.baseUrl}/auth/request-otp`, {
          method: 'POST',
          headers: this.getHeaders()
        });
        return await res.json();
      } catch (err) {
        return { success: false, error: err.message };
      }
    },

    // ── Security & Account Settings ───────────────────────────
    async changePassword(currentPassword, newPassword) {
      try {
        const res = await fetch(`${this.baseUrl}/auth/change-password`, {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({ currentPassword, newPassword })
        });
        return await res.json();
      } catch (err) {
        return { success: false, error: err.message };
      }
    },

    async updateProfile(profileData) {
      try {
        const res = await fetch(`${this.baseUrl}/auth/profile`, {
          method: 'PUT',
          headers: this.getHeaders(),
          body: JSON.stringify(profileData)
        });
        const data = await res.json();
        if (data.success && data.user) {
          const current = JSON.parse(localStorage.getItem('smarthub_user') || '{}');
          localStorage.setItem('smarthub_user', JSON.stringify({ ...current, ...data.user, isLoggedIn: true }));
        }
        return data;
      } catch (err) {
        return { success: false, error: err.message };
      }
    },

    // ── Products & Marketplace ────────────────────────────────
    async getProducts(params = {}) {
      try {
        const query = new URLSearchParams(params).toString();
        const res = await fetch(`${this.baseUrl}/products?${query}`);
        const data = await this.safeJson(res);
        if (data && data.success && Array.isArray(data.products)) {
          // Sync with local SmartHubData
          if (!window.SmartHubData) window.SmartHubData = {};
          window.SmartHubData.products = data.products;
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
        const data = await this.safeJson(res);
        if (data && data.success && data.product) {
          if (!window.SmartHubData) window.SmartHubData = {};
          if (!window.SmartHubData.products) window.SmartHubData.products = [];
          window.SmartHubData.products.unshift(data.product);
        }
        return data;
      } catch (err) {
        return { success: false, error: err.message };
      }
    },

    // ── GitHub-like Project Repository API ────────────────────
    async getProjectRepo(id) {
      try {
        const res = await fetch(`${this.baseUrl}/projects/${id}/repo`, {
          headers: this.getHeaders()
        });
        return await res.json();
      } catch (err) {
        return { success: false, error: err.message };
      }
    },

    async getProjectBlob(id, path) {
      try {
        const res = await fetch(`${this.baseUrl}/projects/${id}/blob?path=${encodeURIComponent(path)}`, {
          headers: this.getHeaders()
        });
        return await res.json();
      } catch (err) {
        return { success: false, error: err.message };
      }
    },

    async starProject(id) {
      try {
        const res = await fetch(`${this.baseUrl}/projects/${id}/star`, {
          method: 'POST',
          headers: this.getHeaders()
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

    // ── Super Admin Control Center API ────────────────────────
    async getAdminOverview() {
      try {
        const res = await fetch(`${this.baseUrl}/admin/overview`, { headers: this.getHeaders() });
        return await res.json();
      } catch (err) {
        return { success: false, error: err.message };
      }
    },

    async getAdminUsers() {
      try {
        const res = await fetch(`${this.baseUrl}/admin/users`, { headers: this.getHeaders() });
        return await res.json();
      } catch (err) {
        return { success: false, error: err.message, users: [] };
      }
    },

    async updateAdminUserRole(userId, role) {
      try {
        const res = await fetch(`${this.baseUrl}/admin/users/${userId}/role`, {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({ role })
        });
        return await res.json();
      } catch (err) {
        return { success: false, error: err.message };
      }
    },

    async adjustAdminUserWallet(userId, amount, reason) {
      try {
        const res = await fetch(`${this.baseUrl}/admin/users/${userId}/wallet`, {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({ amount, reason })
        });
        return await res.json();
      } catch (err) {
        return { success: false, error: err.message };
      }
    },

    async getAdminProducts() {
      try {
        const res = await fetch(`${this.baseUrl}/admin/products`, { headers: this.getHeaders() });
        return await res.json();
      } catch (err) {
        return { success: false, error: err.message, products: [] };
      }
    },

    async deleteAdminProduct(productId) {
      try {
        const res = await fetch(`${this.baseUrl}/admin/products/${productId}`, {
          method: 'DELETE',
          headers: this.getHeaders()
        });
        return await res.json();
      } catch (err) {
        return { success: false, error: err.message };
      }
    },

    async getAdminTransactions() {
      try {
        const res = await fetch(`${this.baseUrl}/admin/transactions`, { headers: this.getHeaders() });
        return await res.json();
      } catch (err) {
        return { success: false, error: err.message, transactions: [] };
      }
    },

    async getAdminApiKeys() {
      try {
        const res = await fetch(`${this.baseUrl}/admin/api-keys`, { headers: this.getHeaders() });
        return await res.json();
      } catch (err) {
        return { success: false, error: err.message, apiKeys: [] };
      }
    },

    async revokeAdminApiKey(keyId) {
      try {
        const res = await fetch(`${this.baseUrl}/admin/api-keys/${keyId}`, {
          method: 'DELETE',
          headers: this.getHeaders()
        });
        return await res.json();
      } catch (err) {
        return { success: false, error: err.message };
      }
    },

    async getAdminRawDatabase() {
      try {
        const res = await fetch(`${this.baseUrl}/admin/raw-database`, { headers: this.getHeaders() });
        return await res.json();
      } catch (err) {
        return { success: false, error: err.message };
      }
    },

    async syncAdminSupabase() {
      try {
        const res = await fetch(`${this.baseUrl}/admin/sync-supabase`, {
          method: 'POST',
          headers: this.getHeaders()
        });
        return await res.json();
      } catch (err) {
        return { success: false, error: err.message };
      }
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
          // If user is logged in, sync genuine profile & wallet from backend
          const rawUser = localStorage.getItem('smarthub_user');
          if (rawUser) {
            try {
              await this.getMe();
              await this.getWallet();
            } catch (uErr) {}
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
