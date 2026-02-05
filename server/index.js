const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');

const db = require('./config/database');

const authRoutes = require('./routes/auth');
const catalogRoutes = require('./routes/catalog');
const productRoutes = require('./routes/products');
const importRoutes = require('./routes/import');
const logRoutes = require('./routes/logs');
const userRoutes = require('./routes/users');
const pdfRoutes = require('./routes/pdf');

const app = express();

const PORT = Number.parseInt(process.env.PORT, 10) || 3000;
const TRUST_PROXY = process.env.TRUST_PROXY === '1';
const SOURCE_DIR = process.env.SOURCE_HTML_DIR
  ? path.resolve(process.env.SOURCE_HTML_DIR)
  : path.resolve(__dirname, '../supplier_html');
const PUBLIC_DIR = path.resolve(__dirname, '../public');

const ALLOWED_IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif']);

if (TRUST_PROXY) {
  app.set('trust proxy', 1);
}

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, source_directory: SOURCE_DIR });
});

app.get('/api/categories', (_req, res) => {
  try {
    const categories = db.prepare(`
      SELECT id, name, slug, name_en, description
      FROM categories
      ORDER BY name COLLATE NOCASE
    `).all();
    res.json({ categories });
  } catch (err) {
    console.error('Categories alias error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/images/*', (req, res) => {
  try {
    const rawPath = decodeURIComponent(req.params[0] || '');
    if (!rawPath) {
      return res.status(400).json({ error: 'Image path is required' });
    }

    const normalizedRelativePath = path.normalize(rawPath).replace(/\\/g, '/');
    if (normalizedRelativePath.startsWith('..') || normalizedRelativePath.includes('/..')) {
      return res.status(400).json({ error: 'Invalid image path' });
    }

    if (!normalizedRelativePath.includes('_files/')) {
      return res.status(400).json({ error: 'Only supplier image folders are allowed' });
    }

    const extension = path.extname(normalizedRelativePath).toLowerCase();
    if (!ALLOWED_IMAGE_EXTENSIONS.has(extension)) {
      return res.status(400).json({ error: 'Unsupported image type' });
    }

    const resolvedPath = path.resolve(SOURCE_DIR, normalizedRelativePath);
    if (!resolvedPath.startsWith(SOURCE_DIR)) {
      return res.status(403).json({ error: 'Forbidden path' });
    }

    if (!fs.existsSync(resolvedPath) || !fs.statSync(resolvedPath).isFile()) {
      return res.status(404).json({ error: 'Image not found' });
    }

    return res.sendFile(resolvedPath);
  } catch (err) {
    console.error('Image serving error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/catalog', catalogRoutes);
app.use('/api/products', productRoutes);
app.use('/api/import', importRoutes);
app.use('/api/logs', logRoutes);
app.use('/api/users', userRoutes);
app.use('/api/pdf', pdfRoutes);

app.use(express.static(PUBLIC_DIR));

app.get('*', (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.use((err, _req, res, _next) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({ error: 'Unexpected server error' });
});

app.listen(PORT, () => {
  console.log(`Cafe Stock Tracker running on http://localhost:${PORT}`);
  console.log(`Source HTML directory: ${SOURCE_DIR}`);
});
