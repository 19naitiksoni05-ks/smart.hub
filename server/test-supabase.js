require('dotenv').config();
const { supabase, isConfigured, testConnection } = require('./supabase');

async function main() {
  console.log('==============================================');
  console.log('   Smart Hub — Supabase Connection Tester     ');
  console.log('==============================================');

  if (!isConfigured()) {
    console.log('❌ Supabase is NOT configured yet in .env.');
    console.log('Please open .env and set:');
    console.log('  SUPABASE_URL=https://your-project.supabase.co');
    console.log('  SUPABASE_SERVICE_ROLE_KEY=your-service-role-key');
    console.log('  SUPABASE_ANON_KEY=your-anon-key\n');
    process.exit(1);
  }

  console.log(`Connecting to: ${process.env.SUPABASE_URL}...`);
  const result = await testConnection();

  if (result.connected) {
    console.log('✅ Connection successful!');
    console.log('Your backend is connected to Supabase.');
  } else {
    console.log('❌ Connection failed:');
    console.log(result.error || result.message);
    if (result.details) {
      console.log('Details:', result.details);
    }
    console.log('\nTip: Make sure you ran the SQL in supabase_schema.sql in your Supabase SQL Editor.');
  }
}

main();
