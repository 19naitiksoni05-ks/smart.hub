// ============================================================
// Smart Hub — Cloud Storage & Serverless File Persistence Test
// ============================================================

// Built-in Node 24 FormData is available globally
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

const API_BASE = 'http://localhost:5000/api';
const JWT_SECRET = process.env.JWT_SECRET || 'smarthub_dev_jwt_secret_key_change_in_production_2026';

async function runCloudTests() {
  console.log('☁️ Testing Smart Hub Cloud Object Storage (Supabase Storage)...\n');
  let passed = 0;
  let failed = 0;

  function assert(condition, name) {
    if (condition) {
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${name}`);
      failed++;
    }
  }

  // 1. Upload Public Image (Must be in Supabase Storage uploads bucket)
  try {
    const form = new FormData();
    const dummyImage = Buffer.from('GIF89a\x01\x00\x01\x00\x80\x00\x00\xff\xff\xff\x00\x00\x00!\xf9\x04\x01\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;');
    form.append('file', new Blob([dummyImage], { type: 'image/gif' }), 'cloud_test_thumb.gif');

    const res = await fetch(`${API_BASE}/upload/image`, {
      method: 'POST',
      body: form
    });
    const data = await res.json();
    assert(
      data.success && data.url.includes('supabase.co/storage/v1/object/public/uploads/images'),
      `Public image uploaded to Supabase Storage CDN: ${data.url?.slice(0, 75)}...`
    );
  } catch (err) {
    assert(false, `Test 1 error: ${err.message}`);
  }

  // 2. Upload Private Codebase Archive (Must be in Supabase Storage archives bucket)
  let cloudArchiveFile = null;
  try {
    const form = new FormData();
    const dummyZip = Buffer.from('PK\x05\x06\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00');
    form.append('file', new Blob([dummyZip], { type: 'application/zip' }), 'cloud_codebase.zip');

    const res = await fetch(`${API_BASE}/upload/single`, {
      method: 'POST',
      body: form
    });
    const data = await res.json();
    cloudArchiveFile = data.file;
    assert(
      data.success && data.file && data.file.storageKey && data.file.storageKey.startsWith('supabase://archives/'),
      `Proprietary archive uploaded to Supabase private bucket: ${data.file?.storageKey}`
    );
  } catch (err) {
    assert(false, `Test 2 error: ${err.message}`);
  }

  // 3. Buyer Authorized Download of Cloud Archive
  try {
    const db = require('./server/db');
    const buyerId = 'u_buyer_cloud_test_' + Date.now();
    const orderId = 'ord_cloud_' + Date.now();
    const orderNumber = 'SH-ORD-' + Date.now();

    // Create test order
    db.insert('orders', {
      id: orderId,
      orderNumber,
      userId: buyerId,
      productId: 'p_test',
      productTitle: 'Cloud Microservice Asset',
      downloadUrl: cloudArchiveFile?.url || '/uploads/archives/cloud_codebase.zip',
      storageKey: cloudArchiveFile?.storageKey || 'supabase://archives/archives/cloud_codebase.zip',
      amount: 1999,
      status: 'completed'
    });

    const buyerToken = jwt.sign(
      { id: buyerId, name: 'Cloud Buyer', role: 'buyer', email: 'cloudbuyer@test.io' },
      JWT_SECRET
    );

    const res = await fetch(`${API_BASE}/orders/${orderNumber}/download`, {
      headers: { 'Authorization': `Bearer ${buyerToken}` }
    });
    const data = await res.json();
    console.log('TEST 3 DATA:', data);

    assert(
      data.success && data.deliveryType === 'cloud_object_storage' && data.downloadUrl && data.downloadUrl.includes('supabase.co/storage/v1/object/sign/archives'),
      `Authorized buyer receives signed Supabase download URL: ${data.downloadUrl?.slice(0, 75)}...`
    );

    // Clean up test order
    db.delete('orders', orderId);
  } catch (err) {
    assert(false, `Test 3 error: ${err.message}`);
  }

  // 4. Unauthorized User Blocked
  try {
    const res = await fetch(`${API_BASE}/orders/ord_cloud_9999/download`);
    assert(res.status === 401, 'Unauthenticated user rejected from cloud download (HTTP 401)');
  } catch (err) {
    assert(false, `Test 4 error: ${err.message}`);
  }

  console.log(`\n🏁 Cloud Storage Verification: ${passed} passed, ${failed} failed.\n`);
  process.exit(failed > 0 ? 1 : 0);
}

runCloudTests();
