const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const db = require('../db');
const { authOptional } = require('../middleware/auth');
const { supabase, isSupabaseConfigured } = require('../supabase');
const { validatePythonCode, isPythonFile } = require('../utils/pythonValidator');

const IS_VERCEL = Boolean(process.env.VERCEL);
// Base directory for uploads (use /tmp on serverless read-only platforms)
const UPLOADS_ROOT = IS_VERCEL ? path.join('/tmp', 'uploads') : path.join(__dirname, '../../uploads');
const DIRS = {
  images: path.join(UPLOADS_ROOT, 'images'),
  videos: path.join(UPLOADS_ROOT, 'videos'),
  files: path.join(UPLOADS_ROOT, 'files'),
  archives: path.join(UPLOADS_ROOT, 'archives'),
  folders: path.join(UPLOADS_ROOT, 'folders')
};

// Ensure all upload directories exist safely without throwing on read-only environments
Object.values(DIRS).forEach(dir => {
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  } catch (e) {
    // Graceful fallback for read-only filesystem environments
  }
});

// Helper for formatting file size
function formatBytes(bytes, decimals = 2) {
  if (!bytes || bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Determine upload subcategory based on extension/mimetype
function categorizeFile(filename, mimetype = '') {
  const ext = path.extname(filename).toLowerCase();
  const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.ico'];
  const videoExts = ['.mp4', '.webm', '.mov', '.avi', '.mkv', '.m4v', '.ogv'];
  const archiveExts = ['.zip', '.tar', '.gz', '.tgz', '.rar', '.7z'];

  if (imageExts.includes(ext) || mimetype.startsWith('image/')) return 'images';
  if (videoExts.includes(ext) || mimetype.startsWith('video/')) return 'videos';
  if (archiveExts.includes(ext) || mimetype.includes('zip') || mimetype.includes('compressed')) return 'archives';
  return 'files';
}

// Multer Storage Engine
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const category = categorizeFile(file.originalname, file.mimetype);
    cb(null, DIRS[category]);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
    const uniqueSuffix = Date.now() + '_' + crypto.randomBytes(4).toString('hex');
    cb(null, `${base}_${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 500 * 1024 * 1024 // 500 MB max limit
  }
});

// Helper middleware to accept any single file field name ('file', 'image', 'video', 'avatar', etc.)
const anySingleFile = (req, res, next) => {
  upload.any()(req, res, (err) => {
    if (err) return res.status(400).json({ success: false, error: err.message });
    req.file = (req.files && req.files.length > 0) ? req.files[0] : null;
    next();
  });
};

// ── 1. Single Media / File Upload Endpoint ─────────────────────
router.post('/single', authOptional, anySingleFile, (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file was uploaded in request' });
    }

    const category = categorizeFile(req.file.originalname, req.file.mimetype);
    const relativeUrl = `/uploads/${category}/${req.file.filename}`;

    // Python Genuine Source Validation Check
    const ext = path.extname(req.file.originalname).toLowerCase();
    const isPyCategory = req.body && req.body.category && req.body.category.toLowerCase().includes('python');
    if (ext === '.py' || isPyCategory) {
      if (ext !== '.py') {
        if (req.file.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        return res.status(400).json({
          success: false,
          error: `Validation Failed: You selected the Python category, but '${req.file.originalname}' is not a .py script.`
        });
      }
      try {
        const fileContent = fs.readFileSync(req.file.path);
        const pyCheck = validatePythonCode(fileContent, req.file.originalname);
        if (!pyCheck.valid) {
          if (req.file.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
          return res.status(400).json({
            success: false,
            error: pyCheck.error
          });
        }
      } catch (e) {
        console.warn('[Python Check Warning]', e);
      }
    }

    const record = {
      id: 'up_' + Date.now() + '_' + crypto.randomBytes(3).toString('hex'),
      originalName: req.file.originalname,
      filename: req.file.filename,
      category,
      type: category.slice(0, -1), // image, video, file, archive
      mimetype: req.file.mimetype,
      size: req.file.size,
      sizeFormatted: formatBytes(req.file.size),
      url: relativeUrl,
      userId: req.user ? req.user.id : null,
      uploaderName: req.user ? req.user.name : 'Guest Developer',
      createdAt: new Date().toISOString()
    };

    db.insert('uploads', record);

    res.json({
      success: true,
      message: `${record.type.toUpperCase()} uploaded successfully!`,
      file: record,
      url: relativeUrl,
      category
    });
  } catch (err) {
    console.error('[Upload Single Error]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── 2. Dedicated Image Upload Endpoint ────────────────────────
router.post('/image', authOptional, anySingleFile, (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ success: false, error: 'No image was provided in request' });
    }

    const relativeUrl = `/uploads/images/${file.filename}`;
    const record = {
      id: 'img_' + Date.now() + '_' + crypto.randomBytes(3).toString('hex'),
      originalName: file.originalname,
      filename: file.filename,
      category: 'images',
      type: 'image',
      mimetype: file.mimetype,
      size: file.size,
      sizeFormatted: formatBytes(file.size),
      url: relativeUrl,
      userId: req.user ? req.user.id : null,
      uploaderName: req.user ? req.user.name : 'Guest Developer',
      createdAt: new Date().toISOString()
    };

    db.insert('uploads', record);

    res.json({
      success: true,
      message: 'Image uploaded successfully!',
      image: record,
      file: record,
      url: relativeUrl
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── 3. Dedicated Video Upload Endpoint ────────────────────────
router.post('/video', authOptional, anySingleFile, (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ success: false, error: 'No video was provided in request' });
    }

    const relativeUrl = `/uploads/videos/${file.filename}`;
    const record = {
      id: 'vid_' + Date.now() + '_' + crypto.randomBytes(3).toString('hex'),
      originalName: file.originalname,
      filename: file.filename,
      category: 'videos',
      type: 'video',
      mimetype: file.mimetype,
      size: file.size,
      sizeFormatted: formatBytes(file.size),
      url: relativeUrl,
      userId: req.user ? req.user.id : null,
      uploaderName: req.user ? req.user.name : 'Guest Developer',
      createdAt: new Date().toISOString()
    };

    db.insert('uploads', record);

    res.json({
      success: true,
      message: 'Video uploaded successfully!',
      video: record,
      file: record,
      url: relativeUrl
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── 4. Batch / Multiple Files Upload ──────────────────────────
router.post('/multiple', authOptional, upload.array('files', 20), (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, error: 'No files provided' });
    }

    const records = req.files.map(file => {
      const category = categorizeFile(file.originalname, file.mimetype);
      const relativeUrl = `/uploads/${category}/${file.filename}`;
      const rec = {
        id: 'up_' + Date.now() + '_' + crypto.randomBytes(3).toString('hex'),
        originalName: file.originalname,
        filename: file.filename,
        category,
        type: category.slice(0, -1),
        mimetype: file.mimetype,
        size: file.size,
        sizeFormatted: formatBytes(file.size),
        url: relativeUrl,
        userId: req.user ? req.user.id : null,
        uploaderName: req.user ? req.user.name : 'Guest Developer',
        createdAt: new Date().toISOString()
      };
      db.insert('uploads', rec);
      return rec;
    });

    res.json({
      success: true,
      message: `Uploaded ${records.length} files successfully!`,
      files: records
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── 5. Folder Upload with Directory Preservation & ZIP Packaging
// Custom memory storage for reconstructing folder structure
const folderUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 }
});

router.post('/folder', authOptional, folderUpload.any(), async (req, res) => {
  try {
    const files = req.files;
    if (!files || files.length === 0) {
      return res.status(400).json({ success: false, error: 'No folder files provided' });
    }

    // Python Genuine Source Validation Check for Folder Uploads
    const isPyCategory = req.body && req.body.category && req.body.category.toLowerCase().includes('python');
    const pyFiles = files.filter(f => isPythonFile(f.originalname));

    if (isPyCategory && pyFiles.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Validation Failed: Python category selected, but the uploaded folder does not contain any genuine .py Python source files.'
      });
    }

    for (const pyFile of pyFiles) {
      const pyCheck = validatePythonCode(pyFile.buffer, pyFile.originalname);
      if (!pyCheck.valid) {
        return res.status(400).json({
          success: false,
          error: pyCheck.error
        });
      }
    }

    const folderTitle = (req.body.folderName || 'project_package').replace(/[^a-zA-Z0-9_-]/g, '_');
    const folderId = 'folder_' + Date.now() + '_' + crypto.randomBytes(3).toString('hex');
    const targetFolderDir = path.join(DIRS.folders, folderId);
    fs.mkdirSync(targetFolderDir, { recursive: true });

    // Relative paths are passed in body as a JSON array or from file.originalname
    let relativePaths = [];
    try {
      if (req.body.paths) {
        relativePaths = typeof req.body.paths === 'string' ? JSON.parse(req.body.paths) : req.body.paths;
      }
    } catch (e) {}

    let totalBytes = 0;
    const fileManifest = [];

    // 1. Write individual files into folder tree
    files.forEach((file, index) => {
      totalBytes += file.size;
      const rawRel = relativePaths[index] || file.originalname || `file_${index}`;
      let cleanRel = String(rawRel).replace(/^(\.\.[\/\\])+/, '').trim();
      if (cleanRel.startsWith(folderTitle + '/') || cleanRel.startsWith(folderTitle + '\\')) {
        cleanRel = cleanRel.substring(folderTitle.length + 1);
      }
      if (!cleanRel || cleanRel === '.' || cleanRel === '/') {
        cleanRel = file.originalname || `file_${index}`;
      }

      let destPath = path.join(targetFolderDir, cleanRel);
      // Guard against writing to directory itself
      if (destPath === targetFolderDir) {
        destPath = path.join(targetFolderDir, file.originalname || `file_${index}`);
      }
      const destDir = path.dirname(destPath);

      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }

      // If destPath is an existing directory, append file name
      if (fs.existsSync(destPath) && fs.statSync(destPath).isDirectory()) {
        destPath = path.join(destPath, file.originalname || `file_${index}`);
      }

      fs.writeFileSync(destPath, file.buffer);
      fileManifest.push({
        path: cleanRel,
        size: file.size,
        sizeFormatted: formatBytes(file.size)
      });
    });

    // 2. Generate a downloadable ZIP archive of the uploaded folder using AdmZip
    const zipFilename = `${folderTitle}_${Date.now()}.zip`;
    const zipFilePath = path.join(DIRS.archives, zipFilename);
    
    try {
      const AdmZip = require('adm-zip');
      const zip = new AdmZip();
      zip.addLocalFolder(targetFolderDir, folderTitle);
      zip.writeZip(zipFilePath);
    } catch (zipErr) {
      console.warn('[Folder Zip] AdmZip warning:', zipErr);
    }

    const archiveStats = fs.statSync(zipFilePath);
    const zipUrl = `/uploads/archives/${zipFilename}`;
    const folderViewUrl = `/uploads/folders/${folderId}`;

    const record = {
      id: folderId,
      name: folderTitle,
      type: 'folder',
      category: 'folders',
      fileCount: files.length,
      size: totalBytes,
      sizeFormatted: formatBytes(totalBytes),
      zipSize: archiveStats.size,
      zipSizeFormatted: formatBytes(archiveStats.size),
      url: zipUrl, // primary link downloads the zipped bundle
      folderUrl: folderViewUrl,
      files: fileManifest.slice(0, 60), // preview first 60 files in manifest
      userId: req.user ? req.user.id : null,
      uploaderName: req.user ? req.user.name : 'Guest Developer',
      createdAt: new Date().toISOString()
    };

    db.insert('uploads', record);

    res.json({
      success: true,
      message: `Folder "${folderTitle}" uploaded and packaged into ZIP successfully! (${files.length} files)`,
      folder: record,
      zipUrl: record.zipUrl,
      zipFilename: record.zipFilename,
      fileCount: files.length,
      totalSize: totalBytes,
      folderPath: record.folderPath
    });
  } catch (err) {
    console.error('[Folder Upload Error]', err);
    res.status(500).json({ success: false, error: 'Folder processing failed: ' + err.message });
  }
});

// ── 6. Get Uploads Library (Filter by Type & User) ─────────────
router.get('/library', authOptional, (req, res) => {
  try {
    const { type, category } = req.query;
    let list = db.get('uploads') || [];

    if (type) {
      list = list.filter(item => item.type === type);
    } else if (category) {
      list = list.filter(item => item.category === category);
    }

    // Sort newest first
    list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const storageStats = {
      totalFiles: list.length,
      totalImages: list.filter(i => i.type === 'image').length,
      totalVideos: list.filter(i => i.type === 'video').length,
      totalFolders: list.filter(i => i.type === 'folder').length,
      totalDocs: list.filter(i => i.type === 'file' || i.type === 'archive').length,
      totalBytes: list.reduce((sum, i) => sum + (i.size || 0), 0),
      totalFormatted: formatBytes(list.reduce((sum, i) => sum + (i.size || 0), 0)),
      totalSizeFormatted: formatBytes(list.reduce((sum, i) => sum + (i.size || 0), 0))
    };

    res.json({
      success: true,
      count: list.length,
      totalItems: list.length,
      storageStats,
      stats: storageStats,
      library: list
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── 7. Delete Uploaded Item ────────────────────────────────────
router.delete('/:id', authOptional, (req, res) => {
  try {
    const id = req.params.id;
    const item = db.findById('uploads', id);
    if (!item) {
      return res.status(404).json({ success: false, error: 'Upload record not found' });
    }

    // Remove file from disk
    if (item.url && item.url.startsWith('/uploads/')) {
      const filePath = path.join(UPLOADS_ROOT, item.url.replace('/uploads/', ''));
      if (fs.existsSync(filePath)) {
        try { fs.unlinkSync(filePath); } catch (e) {}
      }
    }

    // Remove folder directory if applicable
    if (item.type === 'folder') {
      const folderPath = path.join(DIRS.folders, item.id);
      if (fs.existsSync(folderPath)) {
        try { fs.rmSync(folderPath, { recursive: true, force: true }); } catch (e) {}
      }
    }

    db.delete('uploads', id);

    res.json({
      success: true,
      message: 'Item deleted permanently from media vault'
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
