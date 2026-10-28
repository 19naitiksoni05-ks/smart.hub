require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || 'https://nxmaatedkgligticbzro.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54bWFhdGVka2dsaWd0aWNienJvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5Mjg2MDMzMSwiZXhwIjoyMTA4NDM2MzMxfQ.RWRXN7nV5JZR3TgeyEMWeMQJJSwccUzq5B_OCTUDi8E';

let supabase = null;
let isConfigured = false;

if (supabaseUrl && supabaseKey && !supabaseUrl.includes('your-project') && !supabaseKey.includes('your-key')) {
  try {
    supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
    isConfigured = true;
    console.log('[Supabase] Initialized client for:', supabaseUrl);
  } catch (err) {
    console.error('[Supabase] Initialization error:', err.message);
  }
} else {
  console.log('[Supabase] Credentials not set yet. Running in local JSON storage mode.');
}

async function testConnection() {
  if (!supabase) {
    return {
      connected: false,
      message: 'Supabase credentials not configured in .env'
    };
  }

  try {
    const { data, error } = await supabase.from('categories').select('*').limit(1);
    if (error) {
      return {
        connected: false,
        error: error.message,
        hint: error.hint,
        details: error
      };
    }
    return {
      connected: true,
      message: 'Successfully connected to Supabase!',
      url: supabaseUrl
    };
  } catch (err) {
    return {
      connected: false,
      error: err.message
    };
  }
}

async function syncUserToSupabase(user) {
  if (!supabase || !isConfigured) return { success: false, error: 'Supabase not configured' };
  try {
    const cleanEmail = (user.email || '').toLowerCase().trim();
    if (!cleanEmail) return { success: false, error: 'Email required' };
    const cleanUsername = (user.username || ('@' + cleanEmail.split('@')[0])).trim();
    const row = {
      id: user.id || ('u_' + Date.now()),
      name: user.name || cleanUsername.replace('@', ''),
      username: cleanUsername.startsWith('@') ? cleanUsername : '@' + cleanUsername,
      email: cleanEmail,
      password_hash: user.passwordHash || user.password_hash || '',
      avatar: user.avatar || null,
      wallet_balance: user.walletBalance !== undefined ? user.walletBalance : 0,
      role: user.role || 'buyer',
      xp: user.xp || 0,
      badges: user.badges || 0,
      location: user.location || 'India',
      headline: user.headline || 'Smart Hub Developer',
      created_at: user.createdAt || new Date().toISOString()
    };
    const { error } = await supabase.from('users').upsert([row], { onConflict: 'email' });
    if (error) {
      console.warn('[Supabase] User sync warning:', error.message);
      return { success: false, error: error.message };
    }
    return { success: true, user: row };
  } catch (err) {
    console.warn('[Supabase] User sync error:', err.message);
    return { success: false, error: err.message };
  }
}

module.exports = {
  supabase,
  isConfigured: () => isConfigured,
  isSupabaseConfigured: () => isConfigured,
  testConnection,
  syncUserToSupabase
};
