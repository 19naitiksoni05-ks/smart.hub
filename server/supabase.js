require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;

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
    const { data, error } = await supabase.from('categories').select('count', { count: 'exact', head: true });
    if (error) {
      return {
        connected: false,
        error: error.message,
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

module.exports = {
  supabase,
  isConfigured: () => isConfigured,
  testConnection
};
