/**
 * Smart Hub — Upload & Studio File Extraction Verification
 * Run: node test-upload-verification.js
 */

const fs = require('fs');
const path = require('path');
const express = require('express');

async function runVerification() {
  console.log('\n======================================================');
  console.log('   Smart Hub — Upload & Studio Pipeline Verification  ');
  console.log('======================================================\n');

  const uploadRoute = require('./server/routes/upload');
  const projectsRoute = require('./server/routes/projects');
  const productsRoute = require('./server/routes/products');
  const db = require('./server/db');

  const app = express();
  app.use(express.json());
  app.use('/api/upload', uploadRoute);
  app.use('/api/projects', projectsRoute);
  app.use('/api/products', productsRoute);

  const server = app.listen(0, async () => {
    const port = server.address().port;
    const testFolderId = 'folder_verify_' + Date.now();
    const testFolderDir = path.join(__dirname, 'uploads/folders', testFolderId);

    try {
      // 1. Simulate a real web project folder on disk (webdes)
      fs.mkdirSync(path.join(testFolderDir, 'image'), { recursive: true });
      fs.mkdirSync(path.join(testFolderDir, 'style_img'), { recursive: true });

      fs.writeFileSync(path.join(testFolderDir, 'index.html'), '<!DOCTYPE html><html><head><title>Web Design</title><link rel="stylesheet" href="style.css"></head><body><h1>Web Design Studio</h1></body></html>');
      fs.writeFileSync(path.join(testFolderDir, 'style.css'), 'body { background: #0d1117; color: #f0f6fc; } h1 { color: #ff5b36; }');
      fs.writeFileSync(path.join(testFolderDir, 'script.js'), 'console.log("Web design loaded successfully");');
      fs.writeFileSync(path.join(testFolderDir, 'image', 'banner.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
      fs.writeFileSync(path.join(testFolderDir, 'style_img', 'bg.jpg'), Buffer.from([0xff, 0xd8, 0xff, 0xe0]));

      // 2. Create product referencing this folder
      const testProduct = {
        id: 'p_verify_' + Date.now(),
        title: 'WEB DESIGN',
        category: 'React & Next.js',
        price: 1999,
        description: 'Complete web design responsive package',
        bundleInfo: {
          type: 'folder',
          folderId: testFolderId,
          folderName: 'webdes',
          fileCount: 5
        }
      };
      db.insert('products', testProduct);

      // 3. Query Repo Endpoint to verify all files are read and structured
      const res = await fetch(`http://127.0.0.1:${port}/api/projects/${testProduct.id}/repo`);
      const data = await res.json();

      if (!data.success || !data.repo) {
        throw new Error('Failed to fetch project repository');
      }

      console.log('✓ Project Title:    ', data.repo.title);
      console.log('✓ Category:         ', data.repo.category);
      console.log('✓ Total Files Read: ', data.repo.fileCount);
      console.log('\n--- Repository Tree (Folders & Files Found) ---');
      data.repo.tree.forEach(item => {
        const icon = item.type === 'dir' ? '📁' : '📄';
        console.log(`  ${icon} ${item.path} (${item.size || 0} Bytes)`);
      });

      console.log('\n--- Detected Languages ---');
      data.repo.languages.forEach(l => {
        console.log(`  ✦ ${l.name}: ${l.percent}%`);
      });

      // Assertions
      const hasHtml = data.repo.tree.some(t => t.path === 'index.html');
      const hasCss = data.repo.tree.some(t => t.path === 'style.css');
      const hasJs = data.repo.tree.some(t => t.path === 'script.js');
      const hasImage = data.repo.tree.some(t => t.path.includes('image/banner.png'));
      const hasStyleImg = data.repo.tree.some(t => t.path.includes('style_img/bg.jpg'));

      if (hasHtml && hasCss && hasJs && hasImage && hasStyleImg) {
        console.log('\n✅ TEST PASSED: All files in the folder were read and show up accurately!');
      } else {
        console.log('\n❌ TEST FAILED: Some files were missing in the tree.');
      }

      // Clean up test records
      db.delete('products', testProduct.id);
      try { fs.rmSync(testFolderDir, { recursive: true, force: true }); } catch (e) {}

    } catch (err) {
      console.error('Verification error:', err);
    } finally {
      server.close();
      console.log('\n======================================================\n');
    }
  });
}

runVerification();

