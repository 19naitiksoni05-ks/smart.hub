-- ====================================================================
-- SMART HUB (smart.hub) — Complete Supabase PostgreSQL Schema & Seeds
-- Run this script in your Supabase Dashboard -> SQL Editor -> Run
-- ====================================================================

-- Enable UUID extension if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. CATEGORIES TABLE
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY DEFAULT ('cat_' || floor(random() * 1000000)::text),
  name TEXT UNIQUE NOT NULL,
  icon TEXT DEFAULT '📦',
  count INTEGER DEFAULT 0,
  color TEXT DEFAULT '#ff5b36',
  bg TEXT DEFAULT 'rgba(255,91,54,0.1)',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. USERS TABLE
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  avatar TEXT,
  wallet_balance NUMERIC(12, 2) DEFAULT 500.00,
  role TEXT DEFAULT 'buyer',
  xp INTEGER DEFAULT 0,
  badges INTEGER DEFAULT 0,
  location TEXT DEFAULT 'India',
  headline TEXT DEFAULT 'Smart Hub Developer',
  bio TEXT,
  github_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. PRODUCTS TABLE
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10, 2) NOT NULL DEFAULT 0,
  original_price NUMERIC(10, 2),
  discount INTEGER DEFAULT 0,
  category TEXT NOT NULL,
  badge TEXT,
  rating NUMERIC(3, 2) DEFAULT 5.0,
  reviews_count INTEGER DEFAULT 0,
  sales_count INTEGER DEFAULT 0,
  seller_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  seller_name TEXT,
  seller_avatar TEXT,
  live_demo_url TEXT,
  download_url TEXT,
  thumbnail TEXT,
  tags JSONB DEFAULT '[]'::jsonb,
  features JSONB DEFAULT '[]'::jsonb,
  tech_stack JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. ORDERS TABLE
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  product_title TEXT NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  currency TEXT DEFAULT 'INR',
  status TEXT DEFAULT 'completed',
  encryption_key TEXT,
  seller_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. TRANSACTIONS TABLE
CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('credit', 'debit')),
  title TEXT NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  date TEXT,
  status TEXT DEFAULT 'completed',
  reference_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. POSTS / COMMUNITY FEED TABLE
CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL,
  author_username TEXT NOT NULL,
  author_avatar TEXT,
  content TEXT NOT NULL,
  code_snippet TEXT,
  code_language TEXT DEFAULT 'javascript',
  media_url TEXT,
  tags JSONB DEFAULT '[]'::jsonb,
  likes INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  shares_count INTEGER DEFAULT 0,
  liked_by JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. CHANNELS TABLE (DISCORD-STYLE)
CREATE TABLE IF NOT EXISTS channels (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  icon TEXT DEFAULT '#',
  unread INTEGER DEFAULT 0,
  type TEXT DEFAULT 'text',
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. CHANNEL MESSAGES
CREATE TABLE IF NOT EXISTS channel_messages (
  id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  user_avatar TEXT,
  content TEXT NOT NULL,
  reactions JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. CONVERSATIONS (DIRECT MESSAGES / GROUPS)
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  participant_ids JSONB DEFAULT '[]'::jsonb,
  name TEXT,
  is_group BOOLEAN DEFAULT FALSE,
  last_message TEXT,
  last_message_time TIMESTAMPTZ DEFAULT NOW(),
  unread_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. CHAT MESSAGES (DIRECT MESSAGES)
CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL,
  receiver_id TEXT,
  message TEXT NOT NULL,
  media_url TEXT,
  status TEXT DEFAULT 'sent',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. CHALLENGES TABLE
CREATE TABLE IF NOT EXISTS challenges (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  difficulty INTEGER DEFAULT 1,
  xp INTEGER DEFAULT 100,
  participants INTEGER DEFAULT 0,
  completed BOOLEAN DEFAULT FALSE,
  category TEXT DEFAULT 'Full-Stack',
  deadline TEXT,
  skills JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. REVIEWS TABLE
CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  user_avatar TEXT,
  rating NUMERIC(2, 1) DEFAULT 5.0,
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ====================================================================
-- INITIAL SEED DATA
-- ====================================================================

-- Insert Default Categories
INSERT INTO categories (name, icon, count, color, bg) VALUES
  ('React', '⚛️', 0, '#61dafb', 'rgba(97,218,251,0.1)'),
  ('Mobile', '📱', 0, '#f59e0b', 'rgba(245,158,11,0.1)'),
  ('AI/ML', '🤖', 0, '#8b5cf6', 'rgba(139,92,246,0.1)'),
  ('Templates', '🎨', 0, '#ec4899', 'rgba(236,72,153,0.1)'),
  ('Backend', '⚙️', 0, '#06b6d4', 'rgba(6,182,212,0.1)'),
  ('Blockchain', '🔗', 0, '#f59e0b', 'rgba(245,158,11,0.1)'),
  ('Data Science', '📊', 0, '#10b981', 'rgba(16,185,129,0.1)'),
  ('UI Kit', '🎭', 0, '#ec4899', 'rgba(236,72,153,0.1)')
ON CONFLICT (name) DO NOTHING;

-- Insert Default Community Channels
INSERT INTO channels (id, name, icon, unread, type, description) VALUES
  ('c001', 'general', '#', 0, 'text', 'General developer discussions and casual chit-chat'),
  ('c002', 'announcements', '📢', 0, 'text', 'Official Smart Hub updates, feature drops, and events'),
  ('c003', 'showcase', '🎨', 0, 'text', 'Showcase your newly launched products and side-projects'),
  ('c004', 'help-desk', '🆘', 0, 'text', 'Technical assistance, bug fixes, and peer support'),
  ('c005', 'react-js', '⚛️', 0, 'text', 'React, Next.js, Remix, and frontend ecosystem'),
  ('c006', 'node-backend', '⚙️', 0, 'text', 'Node.js, Express, databases, microservices & APIs'),
  ('c007', 'mobile-dev', '📱', 0, 'text', 'Flutter, React Native, Swift, Kotlin & cross-platform'),
  ('c008', 'ai-ml', '🤖', 0, 'text', 'Generative AI, LLMs, LangChain, PyTorch & agents')
ON CONFLICT (id) DO NOTHING;

-- Insert Default Skill Challenges
INSERT INTO challenges (id, title, description, difficulty, xp, participants, completed, category, deadline, skills) VALUES
  ('ms001', 'Milestone 1: Repository Architecture & Clean Git Workflow', 'Initialize your production repository with structured directory architecture, clean branching conventions, and semantic Git commits.', 1, 150, 0, false, 'Milestone', '2026-12-31', '["Git", "Repository Architecture", "Version Control"]'::jsonb),
  ('ms002', 'Milestone 2: Production Code Audit & Zero-Vulnerability Scan', 'Run automated static AST security analysis on your codebase to ensure zero secrets leaks, clean dependency trees, and SHA-256 package checksum verification.', 1, 250, 0, false, 'Milestone', '2026-12-31', '["Security Audit", "AST Scanner", "SHA-256"]'::jsonb),
  ('ms003', 'Milestone 3: Automated Test Suite & CI/CD Pipeline Setup', 'Implement unit and integration test coverage with automated GitHub Actions / CI runner that enforces build pass criteria before release.', 2, 350, 0, false, 'Milestone', '2026-12-31', '["CI/CD", "Automated Testing", "Quality Assurance"]'::jsonb),
  ('ms004', 'Milestone 4: Peer Code Review & Pull Request Verification', 'Complete an end-to-end pull request cycle: conduct constructive peer review, verify type safety, and achieve approved merge status.', 2, 400, 0, false, 'Milestone', '2026-12-31', '["Peer Review", "Architecture", "Pull Requests"]'::jsonb),
  ('ms005', 'Milestone 5: Semantic Versioning & Package Publication', 'Package your clean production codebase complying with SemVer 2.0 specs, generate automated release notes, and deploy version 1.0.0.', 3, 500, 0, false, 'Milestone', '2026-12-31', '["SemVer 2.0", "Packaging", "Release Engineering"]'::jsonb),
  ('ms006', 'Milestone 6: Cryptographic Licensing & Escrow Delivery Token', 'Configure automated encrypted hash token delivery, tamper-evident checksums, and verified instant source code delivery for buyers.', 3, 600, 0, false, 'Milestone', '2026-12-31', '["Cryptography", "License Escrow", "Digital Distribution"]'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- Enable Row Level Security (RLS) but allow public read for marketplace
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public categories are viewable by everyone" ON categories;
CREATE POLICY "Public categories are viewable by everyone" ON categories FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public products are viewable by everyone" ON products;
CREATE POLICY "Public products are viewable by everyone" ON products FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public channels are viewable by everyone" ON channels;
CREATE POLICY "Public channels are viewable by everyone" ON channels FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public challenges are viewable by everyone" ON challenges;
CREATE POLICY "Public challenges are viewable by everyone" ON challenges FOR SELECT USING (true);

-- ====================================================================
-- GRANT API PERMISSIONS (Required by Supabase PostgREST & Service Role)
-- ====================================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO anon, authenticated, service_role;
