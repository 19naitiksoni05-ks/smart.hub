// ============================================================
// Smart Hub — Cloud Object Storage Service (Supabase Storage)
// Multi-region, CDN-cached, persistent cloud storage for serverless
// ============================================================

const path = require('path');
const fs = require('fs');
const { supabase, isSupabaseConfigured } = require('./supabase');

const PUBLIC_BUCKET = 'uploads';
const PRIVATE_BUCKET = 'archives';

let bucketsInitialized = false;

// Ensure storage buckets exist in Supabase project
async function initBuckets() {
  if (bucketsInitialized || !isSupabaseConfigured() || !supabase) return;
  try {
    const { data: buckets } = await supabase.storage.listBuckets();
    const existing = (buckets || []).map(b => b.name);

    if (!existing.includes(PUBLIC_BUCKET)) {
      await supabase.storage.createBucket(PUBLIC_BUCKET, { public: true });
      console.log(`[CloudStorage] Created public bucket: '${PUBLIC_BUCKET}'`);
    }

    if (!existing.includes(PRIVATE_BUCKET)) {
      await supabase.storage.createBucket(PRIVATE_BUCKET, { public: false });
      console.log(`[CloudStorage] Created private bucket: '${PRIVATE_BUCKET}'`);
    }

    bucketsInitialized = true;
  } catch (err) {
    console.warn('[CloudStorage] Bucket initialization notice:', err.message);
  }
}

// ── Upload Buffer to Cloud Storage ───────────────────────────
async function uploadToCloud({ buffer, fileName, mimeType, isPrivate = false, category = 'files' }) {
  await initBuckets();

  if (!isSupabaseConfigured() || !supabase) {
    return { cloud: false, localFallback: true };
  }

  try {
    const bucket = isPrivate ? PRIVATE_BUCKET : PUBLIC_BUCKET;
    const cleanPath = `${category}/${fileName}`.replace(/\/+/g, '/');

    const { data, error } = await supabase.storage.from(bucket).upload(cleanPath, buffer, {
      contentType: mimeType || 'application/octet-stream',
      upsert: true
    });

    if (error) {
      console.warn(`[CloudStorage] Supabase upload warning (${cleanPath}):`, error.message);
      return { cloud: false, error: error.message };
    }

    if (!isPrivate) {
      // Public URL with Supabase global CDN edge caching
      const { data: pUrl } = supabase.storage.from(bucket).getPublicUrl(cleanPath);
      return {
        cloud: true,
        bucket,
        path: cleanPath,
        url: pUrl.publicUrl
      };
    } else {
      // Private archive storage key
      return {
        cloud: true,
        bucket,
        path: cleanPath,
        storageKey: `supabase://${bucket}/${cleanPath}`,
        url: `/api/orders/download-cloud?path=${encodeURIComponent(cleanPath)}`
      };
    }
  } catch (err) {
    console.warn('[CloudStorage] Upload exception:', err.message);
    return { cloud: false, error: err.message };
  }
}

// ── Generate Expiring Signed Download URL for Buyer ──────────
async function getSignedDownloadUrl(cleanPath, expiresInSeconds = 3600) {
  if (!isSupabaseConfigured() || !supabase) return null;

  try {
    const bucket = PRIVATE_BUCKET;
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(cleanPath, expiresInSeconds);
    if (error || !data) {
      console.warn('[CloudStorage] createSignedUrl warning:', error?.message);
      return null;
    }
    return data.signedUrl;
  } catch (err) {
    console.warn('[CloudStorage] Signed URL exception:', err.message);
    return null;
  }
}

module.exports = {
  PUBLIC_BUCKET,
  PRIVATE_BUCKET,
  initBuckets,
  uploadToCloud,
  getSignedDownloadUrl
};
