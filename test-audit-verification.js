// ============================================================
// Smart Hub — Automated Security & Functionality Verification
// Tests auth, admin authorization, password reset, and products
// ============================================================

const API_BASE = 'http://localhost:5000/api';

async function runTests() {
  console.log('🧪 Starting Smart Hub Security & Audit Verification Suite...\n');
  let passed = 0;
  let failed = 0;

  function assert(condition, testName) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      failed++;
    }
  }

  // TEST 1: Bypass password '123456' MUST be rejected for any user
  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity: 'naitik19ansh@gmail.com', password: '123456' })
    });
    const data = await res.json();
    assert(data.success === false, 'Universal bypass password 123456 rejected on login');
  } catch (err) {
    assert(false, `Test 1 error: ${err.message}`);
  }

  // TEST 2: Admin routes MUST reject unauthenticated requests (HTTP 401/403)
  try {
    const res = await fetch(`${API_BASE}/admin/overview`);
    assert(res.status === 401 || res.status === 403, 'Admin overview rejects unauthenticated request');
  } catch (err) {
    assert(false, `Test 2 error: ${err.message}`);
  }

  // TEST 3: Admin routes MUST reject non-admin users (HTTP 403 Forbidden)
  try {
    const jwt = require('jsonwebtoken');
    const fakeBuyerToken = jwt.sign(
      { id: 'u_buyer_test', name: 'Buyer User', role: 'buyer', email: 'buyer@test.io' },
      process.env.JWT_SECRET || 'smarthub_dev_jwt_secret_key_change_in_production_2026'
    );
    const res = await fetch(`${API_BASE}/admin/overview`, {
      headers: { 'Authorization': `Bearer ${fakeBuyerToken}` }
    });
    assert(res.status === 403, 'Admin overview returns 403 Forbidden for non-admin user');
  } catch (err) {
    assert(false, `Test 3 error: ${err.message}`);
  }

  // TEST 4: Secure Password Reset Flow (Request Token -> Invalid token rejected)
  try {
    const res = await fetch(`${API_BASE}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'naitiksoni700@gmail.com' })
    });
    const data = await res.json();
    assert(data.success === true, 'Forgot password initiates token generation');

    // Attempting reset with bogus token must fail
    const resetRes = await fetch(`${API_BASE}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'bogus_invalid_token_123', newPassword: 'NewSecurePassword2026!' })
    });
    const resetData = await resetRes.json();
    assert(resetData.success === false, 'Invalid password reset token rejected');
  } catch (err) {
    assert(false, `Test 4 error: ${err.message}`);
  }

  // TEST 5: Codebase direct archive access MUST be blocked (HTTP 403)
  try {
    const res = await fetch('http://localhost:5000/uploads/archives/secret.zip');
    assert(res.status === 403, 'Direct access to /uploads/archives is blocked with 403');
  } catch (err) {
    assert(false, `Test 5 error: ${err.message}`);
  }

  // TEST 6: Newsletter subscription endpoint validates and handles duplicates
  try {
    const subEmail = `test_newsletter_${Date.now()}@example.com`;
    const res1 = await fetch(`${API_BASE}/newsletter/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: subEmail })
    });
    const data1 = await res1.json();
    assert(data1.success === true, 'Newsletter subscription succeeds for valid email');

    // Duplicate subscription must return clean notice without crashing
    const res2 = await fetch(`${API_BASE}/newsletter/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: subEmail })
    });
    const data2 = await res2.json();
    assert(data2.success === true && data2.alreadySubscribed === true, 'Newsletter handles duplicate gracefully');
  } catch (err) {
    assert(false, `Test 6 error: ${err.message}`);
  }

  // TEST 7: Product creation with custom creator persists with accurate author info
  try {
    const res = await fetch(`${API_BASE}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Audit Verification Suite Kit',
        category: 'Full Stack SaaS',
        price: 1499,
        author: {
          id: 'u_audit_creator',
          name: 'Independent Developer',
          username: '@indie_dev'
        }
      })
    });
    const data = await res.json();
    assert(
      data.success === true && data.product.author.name === 'Independent Developer',
      'Product created with verified author info (not Super Admin)'
    );
    // Cleanup created test product
    if (data.product && data.product.id) {
      const db = require('./server/db');
      db.delete('products', data.product.id);
    }
  } catch (err) {
    assert(false, `Test 7 error: ${err.message}`);
  }

  console.log(`\n🏁 Test Results: ${passed} passed, ${failed} failed.\n`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();

