// ============================================================
// SMART HUB — Client Data Store (Clean Production Initial State)
// ============================================================

const SmartHubData = {

  // ── Products/Projects (Clean initial store) ────────────────
  products: [],

  // ── Categories ────────────────────────────────────────────
  categories: [
    { name: 'Python', icon: '🐍', count: 1, color: '#3572A5', bg: 'rgba(53,114,165,0.1)' },
    { name: 'AI & Machine Learning', icon: '🤖', count: 0, color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)' },
    { name: 'React & Next.js', icon: '⚛️', count: 0, color: '#61dafb', bg: 'rgba(97,218,251,0.1)' },
    { name: 'Mobile & Flutter', icon: '📱', count: 0, color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
    { name: 'Backend & APIs', icon: '⚙️', count: 0, color: '#06b6d4', bg: 'rgba(6,182,212,0.1)' },
    { name: 'Full Stack SaaS', icon: '🚀', count: 0, color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
    { name: 'Data Science', icon: '📊', count: 0, color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
    { name: 'Automation & Scraping', icon: '🕷️', count: 0, color: '#eab308', bg: 'rgba(234,179,8,0.1)' },
    { name: 'Cybersecurity & Tools', icon: '🛡️', count: 0, color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
    { name: 'DevOps & Cloud', icon: '☁️', count: 0, color: '#0ea5e9', bg: 'rgba(14,165,233,0.1)' },
    { name: 'Blockchain & Web3', icon: '🔗', count: 0, color: '#f97316', bg: 'rgba(249,115,22,0.1)' },
    { name: 'Templates & UI Kits', icon: '🎨', count: 0, color: '#ec4899', bg: 'rgba(236,72,153,0.1)' },
  ],

  // ── Reviews ───────────────────────────────────────────────
  reviews: [],

  // ── Community Channels ────────────────────────────────────
  channels: [
    { id: 'c001', name: 'general', icon: '#', unread: 0, type: 'text' },
    { id: 'c002', name: 'announcements', icon: '📢', unread: 0, type: 'text' },
    { id: 'c003', name: 'showcase', icon: '🎨', unread: 0, type: 'text' },
    { id: 'c004', name: 'help-desk', icon: '🆘', unread: 0, type: 'text' },
    { id: 'c005', name: 'react-js', icon: '⚛️', unread: 0, type: 'text' },
    { id: 'c006', name: 'node-backend', icon: '⚙️', unread: 0, type: 'text' },
    { id: 'c007', name: 'mobile-dev', icon: '📱', unread: 0, type: 'text' },
    { id: 'c008', name: 'ai-ml', icon: '🤖', unread: 0, type: 'text' },
  ],

  // ── Chat Messages ─────────────────────────────────────────
  messages: [],

  // ── Milestone Challenges ────────────────────────────────────
  challenges: [
    { id: 'ms001', title: 'Milestone 1: Repository Architecture & Clean Git Workflow', desc: 'Initialize your production repository with structured directory architecture, clean branching conventions, and semantic Git commits.', difficulty: 1, xp: 150, participants: 0, completed: false, category: 'Milestone', deadline: '2026-12-31', skills: ['Git', 'Repository Architecture', 'Version Control'] },
    { id: 'ms002', title: 'Milestone 2: Production Code Audit & Zero-Vulnerability Scan', desc: 'Run automated static AST security analysis on your codebase to ensure zero secrets leaks, clean dependency trees, and SHA-256 package checksum verification.', difficulty: 1, xp: 250, participants: 0, completed: false, category: 'Milestone', deadline: '2026-12-31', skills: ['Security Audit', 'AST Scanner', 'SHA-256'] },
    { id: 'ms003', title: 'Milestone 3: Automated Test Suite & CI/CD Pipeline Setup', desc: 'Implement unit and integration test coverage with automated GitHub Actions / CI runner that enforces build pass criteria before release.', difficulty: 2, xp: 350, participants: 0, completed: false, category: 'Milestone', deadline: '2026-12-31', skills: ['CI/CD', 'Automated Testing', 'Quality Assurance'] },
    { id: 'ms004', title: 'Milestone 4: Peer Code Review & Pull Request Verification', desc: 'Complete an end-to-end pull request cycle: conduct constructive peer review, verify type safety, and achieve approved merge status.', difficulty: 2, xp: 400, participants: 0, completed: false, category: 'Milestone', deadline: '2026-12-31', skills: ['Peer Review', 'Architecture', 'Pull Requests'] },
    { id: 'ms005', title: 'Milestone 5: Semantic Versioning & Package Publication', desc: 'Package your clean production codebase complying with SemVer 2.0 specs, generate automated release notes, and deploy version 1.0.0.', difficulty: 3, xp: 500, participants: 0, completed: false, category: 'Milestone', deadline: '2026-12-31', skills: ['SemVer 2.0', 'Packaging', 'Release Engineering'] },
    { id: 'ms006', title: 'Milestone 6: Cryptographic Licensing & Escrow Delivery Token', desc: 'Configure automated encrypted hash token delivery, tamper-evident checksums, and verified instant source code delivery for buyers.', difficulty: 3, xp: 600, participants: 0, completed: false, category: 'Milestone', deadline: '2026-12-31', skills: ['Cryptography', 'License Escrow', 'Digital Distribution'] },
  ],

  // ── Leaderboard ─────────────────────────────────────────────
  leaderboard: [],

  // ── Feed Posts ─────────────────────────────────────────────
  posts: [],

  // ── Transactions ───────────────────────────────────────────
  transactions: [],

};

// Make available globally
window.SmartHubData = SmartHubData;
