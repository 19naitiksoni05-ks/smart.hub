require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { supabase, isConfigured } = require('./supabase');

const DB_FILE = path.join(__dirname, 'data', 'database.json');

async function syncCollection(tableName, items, transformFn = item => item) {
  if (!items || items.length === 0) {
    console.log(`[Sync] ${tableName}: 0 items to sync.`);
    return;
  }

  const rows = items.map(transformFn);
  const { error } = await supabase.from(tableName).upsert(rows, { onConflict: tableName === 'categories' ? 'name' : 'id' });

  if (error) {
    console.error(`❌ [Sync] Error syncing ${tableName}:`, error.message);
  } else {
    console.log(`✅ [Sync] ${tableName}: Successfully synced ${rows.length} records.`);
  }
}

async function main() {
  console.log('==============================================');
  console.log('   Smart Hub — Sync Local Data to Supabase    ');
  console.log('==============================================');

  if (!isConfigured()) {
    console.error('❌ Supabase is not configured in .env. Please add SUPABASE_URL and SUPABASE_KEY.');
    process.exit(1);
  }

  if (!fs.existsSync(DB_FILE)) {
    console.error('❌ Local database file not found at:', DB_FILE);
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));

  try {
    if (data.categories) {
      await syncCollection('categories', data.categories, c => ({
        name: c.name,
        icon: c.icon,
        count: c.count || 0,
        color: c.color,
        bg: c.bg
      }));
    }

    if (data.channels) {
      await syncCollection('channels', data.channels, ch => ({
        id: ch.id,
        name: ch.name,
        icon: ch.icon,
        unread: ch.unread || 0,
        type: ch.type || 'text',
        description: ch.description || ''
      }));
    }

    if (data.challenges) {
      await syncCollection('challenges', data.challenges, ch => ({
        id: ch.id,
        title: ch.title,
        description: ch.desc || ch.description || '',
        difficulty: ch.difficulty || 1,
        xp: ch.xp || 100,
        participants: ch.participants || 0,
        completed: !!ch.completed,
        category: ch.category || 'Milestone',
        deadline: ch.deadline || '2026-12-31',
        skills: ch.skills || []
      }));
    }

    if (data.users && data.users.length > 0) {
      await syncCollection('users', data.users, u => ({
        id: u.id,
        name: u.name,
        username: u.username,
        email: u.email,
        password_hash: u.passwordHash,
        avatar: u.avatar,
        wallet_balance: u.walletBalance || 0,
        role: u.role || 'buyer',
        xp: u.xp || 0,
        badges: u.badges || 0,
        location: u.location || 'India',
        headline: u.headline || 'Developer'
      }));
    }

    if (data.products && data.products.length > 0) {
      await syncCollection('products', data.products, p => ({
        id: p.id,
        title: p.title,
        description: p.description,
        price: p.price,
        original_price: p.originalPrice || null,
        discount: p.discount || 0,
        category: p.category,
        badge: p.badge || null,
        rating: p.rating || 5.0,
        reviews_count: p.reviewsCount || 0,
        sales_count: p.salesCount || 0,
        seller_id: p.sellerId || null,
        seller_name: p.sellerName || null,
        seller_avatar: p.sellerAvatar || null,
        live_demo_url: p.liveDemoUrl || null,
        download_url: p.downloadUrl || null,
        thumbnail: p.thumbnail || null,
        tags: p.tags || [],
        features: p.features || [],
        tech_stack: p.techStack || []
      }));
    }

    console.log('\n🎉 Sync completed!');
  } catch (err) {
    console.error('❌ Sync failed with error:', err.message);
  }
}

main();
