/**
 * Smart Hub Security & End-to-End Verification Test Suite
 * Tests Auth, RBAC, OAuth Enforcement, Backdoor Removal, Wallet Idempotency,
 * Product Deletion RBAC, and Cryptographic Single-Use Reset Tokens.
 */
const http = require('http');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Ensure test environment
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'smarthub_test_jwt_secret_2026_very_secure';
process.env.PORT = '5055';

const app = require('./server/index');
const db = require('./server/db');

let server;
const PORT = 5055;
const BASE_URL = `http://127.0.0.1:${PORT}`;

let buyerToken = '';
let buyerUser = null;
let adminToken = '';
let adminUser = null;
let testProduct = null;

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const method = options.method || 'GET';
  const headers = { ...options.headers };
  let body = options.body;

  if (body && typeof body === 'object') {
    body = JSON.stringify(body);
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(url, {
    method,
    headers,
    body
  });

  let data = null;
  const text = await res.text();
  try {
    data = JSON.parse(text);
  } catch (e) {
    data = { raw: text };
  }

  return { status: res.status, headers: res.headers, data };
}

async function runTests() {
  console.log('\n======================================================');
  console.log('🛡️  SMART HUB COMPREHENSIVE SECURITY VERIFICATION SUITE');
  console.log('======================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${message}`);
      failed++;
    }
  }

  // 1. Setup seed test users and products in db
  console.log('1. Setting up clean test fixtures in DB...');
  const salt = bcrypt.genSaltSync(10);
  
  const runId = Date.now();
  buyerUser = {
    id: 'u_test_buyer_' + runId,
    name: 'Normal Buyer',
    username: '@normalbuyer_' + runId,
    email: `normalbuyer_${runId}@test.dev`,
    passwordHash: bcrypt.hashSync('StrongBuyerPass123!', salt),
    role: 'buyer',
    walletBalance: 1500,
    emailVerified: true,
    createdAt: new Date().toISOString()
  };
  db.insert('users', buyerUser);

  adminUser = {
    id: 'u_test_admin_' + runId,
    name: 'Verified Admin',
    username: '@verifiedadmin_' + runId,
    email: `verifiedadmin_${runId}@test.dev`,
    passwordHash: bcrypt.hashSync('StrongAdminPass123!', salt),
    role: 'admin',
    walletBalance: 5000,
    emailVerified: true,
    createdAt: new Date().toISOString()
  };
  db.insert('users', adminUser);

  buyerToken = jwt.sign(
    { id: buyerUser.id, name: buyerUser.name, username: buyerUser.username, email: buyerUser.email, role: buyerUser.role },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  adminToken = jwt.sign(
    { id: adminUser.id, name: adminUser.name, username: adminUser.username, email: adminUser.email, role: adminUser.role },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  testProduct = {
    id: 'p_test_' + Date.now(),
    title: 'Secure Test Microservice',
    price: 499,
    author: { id: adminUser.id, name: adminUser.name },
    seller_id: adminUser.id
  };
  db.insert('products', testProduct);

  console.log('  Fixtures initialized successfully.\n');

  // TEST 2: Backdoor Passkey Rejection
  console.log('2. Testing Backdoor Master Passkey Removal...');
  const backdoorAttempts = ['123456', 'admin123', 'naitik123', 'ansh123'];
  for (const pass of backdoorAttempts) {
    const res = await request('/api/auth/login', {
      method: 'POST',
      body: { identity: buyerUser.email, password: pass }
    });
    assert(res.status === 401, `Rejected universal backdoor passkey '${pass}' (HTTP 401)`);
    assert(res.data.error === 'Invalid email/username or password. Please try again.', 'Returned unified anti-enumeration error');
  }

  // TEST 3: Legitimate Login & Set-Cookie verification
  console.log('\n3. Testing Legitimate Login & httpOnly Cookie Issuance...');
  const legitLogin = await request('/api/auth/login', {
    method: 'POST',
    body: { identity: buyerUser.email, password: 'StrongBuyerPass123!' }
  });
  assert(legitLogin.status === 200 && legitLogin.data.success, 'Legitimate login succeeds with 200 OK');
  const setCookie = legitLogin.headers.get('set-cookie') || '';
  assert(setCookie.includes('smarthub_token') && setCookie.includes('HttpOnly'), 'Issued httpOnly smarthub_token session cookie');

  // TEST 4: Anti-Account Enumeration
  console.log('\n4. Testing Account Enumeration Defense...');
  const nonExistentLogin = await request('/api/auth/login', {
    method: 'POST',
    body: { identity: 'completely_random_nobody_12345@domain.com', password: 'randomPassword123!' }
  });
  assert(nonExistentLogin.status === 401, 'Non-existent account login returns HTTP 401');
  assert(nonExistentLogin.data.error === 'Invalid email/username or password. Please try again.', 'Error message identical to wrong password error (no enumeration)');

  const forgotNonExistent = await request('/api/auth/forgot-password', {
    method: 'POST',
    body: { email: 'nonexistent_account_98765@nowhere.com' }
  });
  assert(forgotNonExistent.status === 200, 'Forgot-password returns generic 200 OK');
  assert(forgotNonExistent.data.message.includes('If an account exists'), 'Anti-enumeration message for password reset dispatch');

  // TEST 5: Header Spoofing Defenses
  console.log('\n5. Testing X-User-Id / X-User-Email Spoofing Prevention...');
  const spoofedReq = await request('/api/auth/me', {
    headers: {
      'x-user-id': adminUser.id,
      'x-user-email': adminUser.email,
      'x-user-name': 'FakeAdmin'
    }
  });
  assert(spoofedReq.status === 401, 'Unauthenticated request with spoofed X-User-Id header rejected with 401 Unauthorized');

  // TEST 6: OAuth Direct Username / Email Bypass Elimination
  console.log('\n6. Testing OAuth Code Requirement Enforcement...');
  const fakeGh = await request('/api/auth/github', {
    method: 'POST',
    body: { username: '19naitiksoni05-ks', email: '19naitiksoni05@gmail.com' }
  });
  assert(fakeGh.status === 400, 'GitHub endpoint rejects login without real OAuth code (HTTP 400)');
  assert(fakeGh.data.error.includes('code is required'), 'Explicit code requirement message returned');

  const fakeGoogle = await request('/api/auth/google', {
    method: 'POST',
    body: { email: 'naitik19ansh@gmail.com', name: 'Naitik Soni' }
  });
  assert(fakeGoogle.status === 400, 'Google endpoint rejects login without verified idToken (HTTP 400)');
  assert(fakeGoogle.data.error.includes('idToken is required'), 'Explicit idToken requirement message returned');

  // TEST 7: RBAC on Admin Endpoints
  console.log('\n7. Testing Role-Based Access Control (Admin Routes)...');
  const unauthAdmin = await request('/api/admin/overview');
  assert(unauthAdmin.status === 401, 'Unauthenticated access to /api/admin/overview returns 401');

  const buyerAdmin = await request('/api/admin/overview', {
    headers: { 'Authorization': `Bearer ${buyerToken}` }
  });
  assert(buyerAdmin.status === 403, 'Normal buyer access to /api/admin/overview blocked with 403 Forbidden');

  const legitAdmin = await request('/api/admin/overview', {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  assert(legitAdmin.status === 200 && legitAdmin.data.success, 'Legitimate admin access to /api/admin/overview granted (200 OK)');

  // TEST 8: Object-Level Authorization on Product Deletion
  console.log('\n8. Testing Object-Level Authorization on Product Deletion...');
  const unauthDelete = await request(`/api/products/${testProduct.id}`, {
    method: 'DELETE'
  });
  assert(unauthDelete.status === 401, 'Unauthenticated product delete rejected with 401 Unauthorized');

  const nonOwnerDelete = await request(`/api/products/${testProduct.id}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${buyerToken}` }
  });
  assert(nonOwnerDelete.status === 403, 'Non-owner, non-admin product delete rejected with 403 Forbidden');

  // TEST 9: Wallet Idempotency & Tamper Prevention
  console.log('\n9. Testing Wallet Top-up Idempotency & Input Validation...');
  const negTopup = await request('/api/wallet/topup', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${buyerToken}` },
    body: { amount: -500 }
  });
  assert(negTopup.status === 400, 'Negative amount wallet topup rejected with 400 Bad Request');

  const idempotencyKey = 'idem_key_' + Date.now();
  const topup1 = await request('/api/wallet/topup', {
    method: 'POST',
    headers: { 
      'Authorization': `Bearer ${buyerToken}`,
      'x-idempotency-key': idempotencyKey
    },
    body: { amount: 500 }
  });
  assert(topup1.status === 200 && topup1.data.success, 'First top-up request processed successfully');
  const balAfterTopup1 = topup1.data.newBalance;

  const topup2 = await request('/api/wallet/topup', {
    method: 'POST',
    headers: { 
      'Authorization': `Bearer ${buyerToken}`,
      'x-idempotency-key': idempotencyKey
    },
    body: { amount: 500 }
  });
  console.log(`      [Debug] balAfterTopup1: ${balAfterTopup1}, topup2.newBalance: ${topup2.data.newBalance}`);
  assert(topup2.status === 200 && topup2.data.message.includes('idempotent'), 'Duplicate request with same idempotency key returned idempotent confirmation');
  assert(topup2.data.newBalance === balAfterTopup1, 'Wallet balance NOT double-credited (idempotency enforced)');

  // TEST 10: Wallet Transfer Self-Transfer Block & Insufficient Balance
  console.log('\n10. Testing Wallet Transfer Guards...');
  const selfTransfer = await request('/api/wallet/transfer', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${buyerToken}` },
    body: { recipient: buyerUser.email, amount: 100 }
  });
  assert(selfTransfer.status === 400 && selfTransfer.data.error.includes('own account'), 'Self-transfer prevented with 400 Bad Request');

  const excessiveTransfer = await request('/api/wallet/transfer', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${buyerToken}` },
    body: { recipient: adminUser.email, amount: 25000 }
  });
  assert(excessiveTransfer.status === 400 && excessiveTransfer.data.error.includes('Insufficient'), 'Excessive transfer rejected for insufficient funds');

  const overLimitTransfer = await request('/api/wallet/transfer', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${buyerToken}` },
    body: { recipient: adminUser.email, amount: 999999 }
  });
  assert(overLimitTransfer.status === 400 && overLimitTransfer.data.error.includes('1,00,000'), 'Transfer exceeding maximum single-transaction limit of ₹1,00,000 rejected');

  // TEST 11: Single-Use Expiring Password Reset Token
  console.log('\n11. Testing Single-Use Expiring Password Reset Flow...');
  const forgotRes = await request('/api/auth/forgot-password', {
    method: 'POST',
    body: { email: buyerUser.email }
  });
  assert(forgotRes.status === 200, 'Password reset requested successfully');
  
  // Find token from DB
  const resetRecord = db.findOne('resetTokens', r => r.userId === buyerUser.id && !r.used);
  assert(resetRecord && resetRecord.token, 'Cryptographic reset token generated and saved in DB');

  const resetRes1 = await request('/api/auth/reset-password', {
    method: 'POST',
    body: { token: resetRecord.token, newPassword: 'BrandNewSecurePass456!' }
  });
  assert(resetRes1.status === 200 && resetRes1.data.success, 'First password reset completes successfully');

  // Re-use token immediately
  const resetRes2 = await request('/api/auth/reset-password', {
    method: 'POST',
    body: { token: resetRecord.token, newPassword: 'AnotherPassword789!' }
  });
  assert(resetRes2.status === 400, 'Reusing the same reset token is rejected (Single-use token enforced)');

  // Verify login with new password
  const newPassLogin = await request('/api/auth/login', {
    method: 'POST',
    body: { identity: buyerUser.email, password: 'BrandNewSecurePass456!' }
  });
  assert(newPassLogin.status === 200 && newPassLogin.data.success, 'Can authenticate with newly set password');

  // Final Summary
  console.log('\n======================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

// Start temporary test server
server = app.listen(PORT, async () => {
  try {
    await runTests();
  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  } finally {
    server.close();
  }
});
