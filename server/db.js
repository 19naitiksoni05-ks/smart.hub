const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { supabase, isConfigured } = require('./supabase');

const IS_VERCEL = Boolean(process.env.VERCEL);
const DATA_DIR = IS_VERCEL ? '/tmp' : path.join(__dirname, 'data');
const DB_FILE = IS_VERCEL ? '/tmp/database.json' : path.join(DATA_DIR, 'database.json');
const ORIGINAL_DB_FILE = path.join(__dirname, 'data', 'database.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (e) {}
}

// On Vercel, seed /tmp/database.json from bundled database file
if (IS_VERCEL && !fs.existsSync(DB_FILE)) {
  try {
    if (fs.existsSync(ORIGINAL_DB_FILE)) {
      fs.copyFileSync(ORIGINAL_DB_FILE, DB_FILE);
    }
  } catch (e) {}
}

// Clean initial database structure for fresh deployment
function getInitialSeedData() {
  return {
    users: [],
    products: [],
    categories: [
      { name: 'React', icon: '⚛️', count: 0, color: '#61dafb', bg: 'rgba(97,218,251,0.1)' },
      { name: 'Mobile', icon: '📱', count: 0, color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
      { name: 'AI/ML', icon: '🤖', count: 0, color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)' },
      { name: 'Templates', icon: '🎨', count: 0, color: '#ec4899', bg: 'rgba(236,72,153,0.1)' },
      { name: 'Backend', icon: '⚙️', count: 0, color: '#06b6d4', bg: 'rgba(6,182,212,0.1)' },
      { name: 'Blockchain', icon: '🔗', count: 0, color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
      { name: 'Data Science', icon: '📊', count: 0, color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
      { name: 'UI Kit', icon: '🎭', count: 0, color: '#ec4899', bg: 'rgba(236,72,153,0.1)' }
    ],
    orders: [],
    transactions: [],
    posts: [],
    channels: [
      { id: 'c001', name: 'general', icon: '#', unread: 0, type: 'text', description: 'General developer discussions and casual chit-chat' },
      { id: 'c002', name: 'announcements', icon: '📢', unread: 0, type: 'text', description: 'Official Smart Hub updates, feature drops, and events' },
      { id: 'c003', name: 'showcase', icon: '🎨', unread: 0, type: 'text', description: 'Showcase your newly launched products and side-projects' },
      { id: 'c004', name: 'help-desk', icon: '🆘', unread: 0, type: 'text', description: 'Technical assistance, bug fixes, and peer support' },
      { id: 'c005', name: 'react-js', icon: '⚛️', unread: 0, type: 'text', description: 'React, Next.js, Remix, and frontend ecosystem' },
      { id: 'c006', name: 'node-backend', icon: '⚙️', unread: 0, type: 'text', description: 'Node.js, Express, databases, microservices & APIs' },
      { id: 'c007', name: 'mobile-dev', icon: '📱', unread: 0, type: 'text', description: 'Flutter, React Native, Swift, Kotlin & cross-platform' },
      { id: 'c008', name: 'ai-ml', icon: '🤖', unread: 0, type: 'text', description: 'Generative AI, LLMs, LangChain, PyTorch & agents' }
    ],
    channelMessages: [],
    conversations: [],
    chatMessages: [],
    challenges: [
      { id: 'ms001', title: 'Milestone 1: Repository Architecture & Clean Git Workflow', desc: 'Initialize your production repository with structured directory architecture, clean branching conventions, and semantic Git commits.', difficulty: 1, xp: 150, participants: 0, completed: false, category: 'Milestone', deadline: '2026-12-31', skills: ['Git', 'Repository Architecture', 'Version Control'] },
      { id: 'ms002', title: 'Milestone 2: Production Code Audit & Zero-Vulnerability Scan', desc: 'Run automated static AST security analysis on your codebase to ensure zero secrets leaks, clean dependency trees, and SHA-256 package checksum verification.', difficulty: 1, xp: 250, participants: 0, completed: false, category: 'Milestone', deadline: '2026-12-31', skills: ['Security Audit', 'AST Scanner', 'SHA-256'] },
      { id: 'ms003', title: 'Milestone 3: Automated Test Suite & CI/CD Pipeline Setup', desc: 'Implement unit and integration test coverage with automated GitHub Actions / CI runner that enforces build pass criteria before release.', difficulty: 2, xp: 350, participants: 0, completed: false, category: 'Milestone', deadline: '2026-12-31', skills: ['CI/CD', 'Automated Testing', 'Quality Assurance'] },
      { id: 'ms004', title: 'Milestone 4: Peer Code Review & Pull Request Verification', desc: 'Complete an end-to-end pull request cycle: conduct constructive peer review, verify type safety, and achieve approved merge status.', difficulty: 2, xp: 400, participants: 0, completed: false, category: 'Milestone', deadline: '2026-12-31', skills: ['Peer Review', 'Architecture', 'Pull Requests'] },
      { id: 'ms005', title: 'Milestone 5: Semantic Versioning & Package Publication', desc: 'Package your clean production codebase complying with SemVer 2.0 specs, generate automated release notes, and deploy version 1.0.0.', difficulty: 3, xp: 500, participants: 0, completed: false, category: 'Milestone', deadline: '2026-12-31', skills: ['SemVer 2.0', 'Packaging', 'Release Engineering'] },
      { id: 'ms006', title: 'Milestone 6: Cryptographic Licensing & Escrow Delivery Token', desc: 'Configure automated encrypted hash token delivery, tamper-evident checksums, and verified instant source code delivery for buyers.', difficulty: 3, xp: 600, participants: 0, completed: false, category: 'Milestone', deadline: '2026-12-31', skills: ['Cryptography', 'License Escrow', 'Digital Distribution'] }
    ],
    leaderboard: [],
    reviews: [],
    apiKeys: []
  };
}

class Database {
  constructor() {
    this.data = null;
    this.init();
  }

  init() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf8');
        this.data = JSON.parse(raw);
      } else if (fs.existsSync(ORIGINAL_DB_FILE)) {
        const raw = fs.readFileSync(ORIGINAL_DB_FILE, 'utf8');
        this.data = JSON.parse(raw);
        if (IS_VERCEL) {
          try { fs.writeFileSync(DB_FILE, raw, 'utf8'); } catch (e) {}
        }
      } else {
        this.data = getInitialSeedData();
        this.save();
      }
    } catch (err) {
      console.error('Database load error, resetting to seed data:', err);
      this.data = getInitialSeedData();
      this.save();
    }
  }

  save() {
    try {
      const tempPath = DB_FILE + '.tmp';
      fs.writeFileSync(tempPath, JSON.stringify(this.data, null, 2), 'utf8');
      fs.renameSync(tempPath, DB_FILE);
      return true;
    } catch (err) {
      try {
        // Fallback direct write
        fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf8');
        return true;
      } catch (writeErr) {
        console.error('Database save error:', writeErr.message);
        return false;
      }
    }
  }

  get(collection) {
    if (!this.data[collection]) {
      this.data[collection] = [];
    }
    return this.data[collection];
  }

  find(collection, predicate) {
    const list = this.get(collection);
    return list.filter(predicate);
  }

  findOne(collection, predicate) {
    const list = this.get(collection);
    return list.find(predicate) || null;
  }

  findById(collection, id) {
    return this.findOne(collection, item => item.id === id);
  }

  syncSupabase(action, collection, item) {
    if (!isConfigured() || !supabase) return;

    const tableMap = {
      channelMessages: 'channel_messages',
      chatMessages: 'chat_messages',
      apiKeys: 'api_keys'
    };
    const tableName = tableMap[collection] || collection;

    // Async background sync without blocking local write
    setImmediate(async () => {
      try {
        if (action === 'insert' || action === 'update') {
          // Map camelCase keys to snake_case for Supabase
          const row = {};
          for (const [k, v] of Object.entries(item)) {
            const snakeKey = k.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
            row[snakeKey] = v;
          }
          await supabase.from(tableName).upsert(row, { onConflict: tableName === 'categories' ? 'name' : 'id' });
        } else if (action === 'delete') {
          await supabase.from(tableName).delete().eq('id', item.id);
        }
      } catch (err) {
        console.warn(`[Supabase Sync] Warning syncing ${action} on ${tableName}:`, err.message);
      }
    });
  }

  insert(collection, item) {
    const list = this.get(collection);
    if (!item.id) {
      item.id = 'id_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    }
    if (!item.createdAt) {
      item.createdAt = new Date().toISOString();
    }
    list.unshift(item);
    this.save();
    this.syncSupabase('insert', collection, item);
    return item;
  }

  update(collection, id, updates) {
    const list = this.get(collection);
    const index = list.findIndex(item => item.id === id);
    if (index === -1) return null;
    list[index] = { ...list[index], ...updates, updatedAt: new Date().toISOString() };
    this.save();
    this.syncSupabase('update', collection, list[index]);
    return list[index];
  }

  delete(collection, id) {
    const list = this.get(collection);
    const index = list.findIndex(item => item.id === id);
    if (index === -1) return false;
    const removed = list[index];
    list.splice(index, 1);
    this.save();
    this.syncSupabase('delete', collection, removed);
    return true;
  }
}

const db = new Database();

module.exports = db;
