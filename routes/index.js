const express = require('express');
const router = express.Router();
const { getIndex } = require('../controllers/indexController');
const { processPdf, processPdfWithAllModels } = require('../controllers/pdfController');
const { uploadPdf, handleUploadError } = require('../middleware/fileUploadMiddleware');

// Define routes
router.get('/', getIndex);

// PDF processing routes
router.post('/pdf', uploadPdf, handleUploadError, processPdf);
router.post('/pdf/all', uploadPdf, handleUploadError, processPdfWithAllModels);

module.exports = router;