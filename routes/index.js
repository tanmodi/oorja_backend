const express = require('express');
const router = express.Router();
const { getIndex } = require('../controllers/indexController');
const { processPdf } = require('../controllers/pdfController');
const { uploadPdf, handleUploadError } = require('../middleware/fileUploadMiddleware');

// Define routes
router.get('/', getIndex);

// PDF processing route
router.post('/pdf', uploadPdf, handleUploadError, processPdf);

module.exports = router;