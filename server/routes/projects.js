const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const db = require('../db');
const { authOptional } = require('../middleware/auth');

// ── Realistic Codebase Templates per Category ──────────────────
function generateRepoTreeAndFiles(product) {
  const category = (product.category || 'React').toLowerCase();
  const titleSlug = (product.title || 'project').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const authorName = product.author ? product.author.name : 'Naitik Soni';
  const authorUser = product.author ? (product.author.username || '@developer') : '@developer';

  let tree = [];
  let files = {};

  // Standard README for all repositories
  const readmeMd = `# ${product.title}

[![Smart Hub Verified](https://img.shields.io/badge/Smart%20Hub-Audited%20Package-10b981.svg)](marketplace.html)
[![License: MIT](https://img.shields.io/badge/License-Commercial%20Developer-8b5cf6.svg)](policies.html)
[![Version](https://img.shields.io/badge/Version-v3.2.0-06b6d4.svg)](releases)
[![Build Status](https://img.shields.io/badge/Build-Passing-brightgreen.svg)](repo.html)

> ${product.description || 'Enterprise-grade digital source code asset published on Smart Hub.'}

---

## ⚡ Features & Architecture

- **High-Performance Architecture:** Ultra-fast page transitions, modular clean code, and zero bloated external dependencies.
- **Audited & Secure:** 100% audited for vulnerabilities, malicious injections, and cryptographic entropy.
- **Production Ready:** Pre-configured with environment variables, state controllers, and automated scripts.
- **₹ INR & UPI Integration:** Dynamic QR generation, webhook listeners, and zero-fee wallet deposit compatibility.

---

## 🚀 Quick Start Guide

### 1. Clone or Pull Repository
\`\`\`bash
# Using Smart Hub Developer CLI
smarthub pull ${product.id}

# Or clone directly via Git
git clone https://smarthub.dev/repos/${titleSlug}.git
cd ${titleSlug}
\`\`\`

### 2. Install Dependencies
\`\`\`bash
npm install
# or
yarn install
# or
pnpm install
\`\`\`

### 3. Setup Environment Variables
\`\`\`bash
cp .env.example .env
\`\`\`

Configure your API credentials in \`.env\`:
\`\`\`env
PORT=5000
SMARTHUB_API_KEY=your_key_here
NODE_ENV=production
\`\`\`

### 4. Run Development Server
\`\`\`bash
npm run dev
\`\`\`

Open [http://localhost:3000](http://localhost:3000) with your browser to see the live application.

---

## 📂 Project Directory Structure

\`\`\`text
${titleSlug}/
├── src/
│   ├── components/
│   ├── routes/
│   ├── hooks/
│   └── App.jsx
├── public/
├── .env.example
├── package.json
└── README.md
\`\`\`

---

## 📄 License & Commercial Distribution

Published by **${authorName}** (${authorUser}) under Smart Hub Commercial Developer License.
Includes lifetime access, encrypted token delivery, and free ongoing feature updates.
`;

  if (category.includes('mobile') || category.includes('flutter')) {
    files['README.md'] = readmeMd;
    files['pubspec.yaml'] = `name: ${titleSlug.replace(/-/g, '_')}
description: ${product.description || 'Cross-platform mobile application'}
version: 3.2.0+1
environment:
  sdk: ">=3.0.0 <4.0.0"

dependencies:
  flutter:
    sdk: flutter
  flutter_bloc: ^8.1.3
  http: ^1.2.0
  shared_preferences: ^2.2.2
  cached_network_image: ^3.3.1
  google_fonts: ^6.1.0

dev_dependencies:
  flutter_test:
    sdk: flutter
  flutter_lints: ^3.0.0
`;
    files['lib/main.dart'] = `import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

void main() {
  runApp(const SmartHubApp());
}

class SmartHubApp extends StatelessWidget {
  const SmartHubApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: '${product.title}',
      theme: ThemeData.dark().copyWith(
        primaryColor: const Color(0xFF8B5CF6),
        scaffoldBackgroundColor: const Color(0xFF0D0F19),
        textTheme: GoogleFonts.interTextTheme(ThemeData.dark().textTheme),
      ),
      home: const HomeScreen(),
    );
  }
}

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('${product.title}'),
        backgroundColor: const Color(0xFF141724),
      ),
      body: const Center(
        child: Text(
          'Mobile Studio Engine Active',
          style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
        ),
      ),
    );
  }
}
`;
    files['.env.example'] = `API_URL=https://api.smarthub.dev\nAPP_NAME="${product.title}"\nDEBUG=true\n`;
  } else if (category.includes('ai') || category.includes('python') || category.includes('ml')) {
    files['README.md'] = readmeMd;
    files['requirements.txt'] = `fastapi==0.110.0\nuvicorn==0.28.0\ntorch==2.2.1\ntransformers==4.38.2\npydantic==2.6.4\nnumpy==1.26.4\nrequests==2.31.0\n`;
    files['main.py'] = `from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import uvicorn

app = FastAPI(title="${product.title}", version="3.2.0")

class InferencePayload(BaseModel):
    query: str
    temperature: float = 0.7
    max_tokens: int = 512

@app.get("/")
def read_root():
    return {"status": "online", "model": "${product.title}", "provider": "Smart Hub AI"}

@app.post("/predict")
def predict(payload: InferencePayload):
    # Simulated high-entropy AI inference engine
    return {
        "success": True,
        "query": payload.query,
        "result": f"Synthesized high-performance AI output for: {payload.query}",
        "latency_ms": 38.4
    }

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
`;
    files['model/pipeline.py'] = `"""
Pipeline architecture for ${product.title}
Handles tensor preparation, neural weights, and response tokenization.
"""

class ModelPipeline:
    def __init__(self, weights_path: str = "checkpoints/weights.pt"):
        self.weights_path = weights_path
        self.is_loaded = True

    def process(self, input_text: str):
        return {"processed": True, "tokens": len(input_text.split())}
`;
    files['.env.example'] = `MODEL_KEY=sk_smarthub_ai_model\nPORT=8000\nENV=production\n`;
  } else {
    // Default React & Next.js / FullStack Web App
    files['README.md'] = readmeMd;
    files['package.json'] = `{
  "name": "${titleSlug}",
  "version": "3.2.0",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "lint": "eslint src --ext js,jsx"
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "lucide-react": "^0.359.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.2.1",
    "vite": "^5.1.6"
  }
}
`;
    files['vite.config.js'] = `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true
  }
});
`;
    files['.env.example'] = `VITE_API_URL=https://api.smarthub.dev
VITE_ENABLE_ANALYTICS=true
VITE_PAYMENT_GATEWAY_KEY=rzp_live_smarthub
`;
    files['index.html'] = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${product.title}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
`;
    files['src/main.jsx'] = `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
`;
    files['src/App.jsx'] = `import React, { useState } from 'react';
import Navbar from './components/Navbar';
import Dashboard from './components/Dashboard';

export default function App() {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div className="app-layout">
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />
      <main className="main-content">
        <header className="page-header">
          <h1>${product.title}</h1>
          <p className="subtitle">${product.description || 'Production verified codebase'}</p>
        </header>
        <Dashboard activeTab={activeTab} />
      </main>
    </div>
  );
}
`;
    files['src/components/Navbar.jsx'] = `import React from 'react';

export default function Navbar({ activeTab, setActiveTab }) {
  const items = ['overview', 'analytics', 'settings'];

  return (
    <nav className="navbar">
      <div className="brand">
        <span className="logo">⚡</span>
        <span className="brand-name">${product.title.split(' ')[0]} Hub</span>
      </div>
      <div className="nav-items">
        {items.map(item => (
          <button
            key={item}
            className={'nav-btn ' + (activeTab === item ? 'active' : '')}
            onClick={() => setActiveTab(item)}
          >
            {item.toUpperCase()}
          </button>
        ))}
      </div>
    </nav>
  );
}
`;
    files['src/components/Dashboard.jsx'] = `import React from 'react';

export default function Dashboard({ activeTab }) {
  return (
    <div className="dashboard-grid">
      <div className="card stat-card">
        <h3>System Status</h3>
        <div className="metric">100% OPERATIONAL</div>
        <p>Audited by Smart Hub Platform Security</p>
      </div>
      <div className="card stat-card">
        <h3>Active Version</h3>
        <div className="metric">v3.2.0</div>
        <p>Production Stable Release</p>
      </div>
      <div className="card main-card">
        <h3>Live Architecture Dashboard</h3>
        <p>Active workspace loaded under: <code>{activeTab}</code></p>
      </div>
    </div>
  );
}
`;
    files['src/index.css'] = `:root {
  --bg-primary: #0a0c14;
  --bg-card: #121526;
  --border: #232742;
  --accent: #8b5cf6;
  --text: #f8fafc;
}

body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: var(--bg-primary);
  color: var(--text);
}

.app-layout { min-height: 100vh; display: flex; flex-direction: column; }
.navbar { display: flex; justify-content: space-between; padding: 16px 24px; background: var(--bg-card); border-bottom: 1px solid var(--border); }
.brand { display: flex; align-items: center; gap: 8px; font-weight: 800; font-size: 1.1rem; }
.nav-items { display: flex; gap: 8px; }
.nav-btn { background: transparent; border: 1px solid transparent; color: #94a3b8; padding: 6px 14px; border-radius: 6px; cursor: pointer; }
.nav-btn.active { background: var(--accent); color: #fff; }
.main-content { padding: 32px 24px; max-width: 1100px; margin: 0 auto; width: 100%; box-sizing: border-box; }
.dashboard-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
.card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; padding: 24px; }
.main-card { grid-column: span 2; }
.metric { font-size: 1.8rem; font-weight: 800; color: #10b981; margin: 8px 0; }
`;
  }

  // Build tree list from files
  const filePaths = Object.keys(files);
  const dirSet = new Set();

  filePaths.forEach(fp => {
    const parts = fp.split('/');
    if (parts.length > 1) {
      let cur = '';
      for (let i = 0; i < parts.length - 1; i++) {
        cur = cur ? `${cur}/${parts[i]}` : parts[i];
        dirSet.add(cur);
      }
    }
  });

  // Directories first
  Array.from(dirSet).sort().forEach(dir => {
    const parts = dir.split('/');
    tree.push({
      path: dir,
      name: parts[parts.length - 1],
      type: 'folder',
      parent: parts.length > 1 ? parts.slice(0, -1).join('/') : '',
      size: 0,
      lines: 0,
      lastCommit: 'refactor: modularize core directory structure',
      time: '2 hours ago'
    });
  });

  // Files
  filePaths.sort().forEach(fp => {
    const parts = fp.split('/');
    const content = files[fp];
    const lines = content.split('\n').length;
    const size = Buffer.byteLength(content, 'utf8');

    tree.push({
      path: fp,
      name: parts[parts.length - 1],
      type: 'file',
      parent: parts.length > 1 ? parts.slice(0, -1).join('/') : '',
      size,
      lines,
      lastCommit: fp.endsWith('.md') ? 'docs: update setup and API documentation' : 'feat: implement production logic',
      time: '1 hour ago'
    });
  });

  return { tree, files, readme: files['README.md'] };
}

// ── GET Project Repository Details ────────────────────────────
router.get('/:id/repo', authOptional, (req, res) => {
  try {
    const prodId = req.params.id;
    let product = db.findById('products', prodId);

    if (!product) {
      // Check if it's the first product or match in default dataset
      const allProds = db.get('products');
      if (allProds.length > 0) {
        product = allProds[0];
      }
    }

    if (!product) {
      return res.status(404).json({ success: false, error: 'Project repository not found' });
    }

    const titleSlug = (product.title || 'project').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const { tree, files, readme } = generateRepoTreeAndFiles(product);

    const author = product.author || {
      id: 'dev_verified',
      name: 'Naitik Soni',
      username: '@naitik19',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=naitik19&backgroundColor=ff5b36'
    };

    const repo = {
      id: product.id,
      name: titleSlug,
      title: product.title,
      description: product.description,
      category: product.category,
      price: product.price,
      thumb: product.thumb,
      videoUrl: product.videoUrl,
      downloadUrl: product.downloadUrl || `/api/orders/${product.id}/download`,
      bundleInfo: product.bundleInfo,
      defaultBranch: 'main',
      branches: ['main', 'develop', 'release/v3.2'],
      stars: product.stars || (product.reviews ? product.reviews * 12 : 38),
      forks: product.forks || 7,
      watchers: 24,
      openIssues: 2,
      pullRequests: 1,
      totalCommits: 14,
      license: 'Commercial Developer',
      latestCommit: {
        hash: '7f9c2a1',
        message: 'feat: audited release v3.2.0 with verified cryptography',
        author: author.name,
        avatar: author.avatar,
        time: '2 hours ago',
        date: product.createdAt || new Date().toISOString()
      },
      author,
      tags: product.tags || [product.category, 'Verified', 'OpenSource'],
      languages: [
        { name: 'JavaScript', percent: 64.2, color: '#f7df1e' },
        { name: 'CSS', percent: 22.8, color: '#1572b6' },
        { name: 'HTML', percent: 13.0, color: '#e34f26' }
      ],
      tree,
      readme
    };

    res.json({ success: true, repo });
  } catch (err) {
    console.error('Repo fetch error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch repository metadata' });
  }
});

// ── GET Raw File Content (Blob) ───────────────────────────────
router.get('/:id/blob', authOptional, (req, res) => {
  try {
    const prodId = req.params.id;
    const filePath = req.query.path;

    if (!filePath) {
      return res.status(400).json({ success: false, error: 'File path is required' });
    }

    let product = db.findById('products', prodId);
    if (!product) {
      const allProds = db.get('products');
      if (allProds.length > 0) product = allProds[0];
    }

    if (!product) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }

    const { files } = generateRepoTreeAndFiles(product);
    const content = files[filePath];

    if (content === undefined) {
      return res.status(404).json({ success: false, error: `File '${filePath}' not found in repository` });
    }

    const ext = path.extname(filePath).toLowerCase();
    let language = 'plaintext';
    if (ext === '.js' || ext === '.jsx') language = 'javascript';
    else if (ext === '.ts' || ext === '.tsx') language = 'typescript';
    else if (ext === '.json') language = 'json';
    else if (ext === '.html') language = 'html';
    else if (ext === '.css') language = 'css';
    else if (ext === '.py') language = 'python';
    else if (ext === '.dart') language = 'dart';
    else if (ext === '.yaml' || ext === '.yml') language = 'yaml';
    else if (ext === '.md') language = 'markdown';

    res.json({
      success: true,
      path: filePath,
      language,
      size: Buffer.byteLength(content, 'utf8'),
      lines: content.split('\n').length,
      content
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to load file blob' });
  }
});

// ── Star Repository ───────────────────────────────────────────
router.post('/:id/star', authOptional, (req, res) => {
  try {
    const prodId = req.params.id;
    const product = db.findById('products', prodId);
    if (!product) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }

    product.stars = (product.stars || 38) + 1;
    db.update('products', product.id, { stars: product.stars });

    res.json({ success: true, stars: product.stars, starred: true });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to star project' });
  }
});

module.exports = router;
