const express = require('express');
const path = require('path');
const db = require('../config/database');
const { verifySession, requirePasswordChangeComplete } = require('../middleware/auth');
const { isAdmin } = require('../middleware/roleCheck');
const { makeImportService } = require('../services/importer');

const router = express.Router();
const importService = makeImportService(db);

router.post('/supplier-html', verifySession, requirePasswordChangeComplete, isAdmin, (req, res) => {
  try {
    const sourceDir = path.resolve(__dirname, '../../../');
    const result = importService.importFromHtml(sourceDir, req.user.id);

    res.json({
      success: true,
      source_directory: sourceDir,
      ...result
    });
  } catch (err) {
    console.error('Supplier import error:', err);
    res.status(500).json({ error: 'Import failed' });
  }
});

module.exports = router;
