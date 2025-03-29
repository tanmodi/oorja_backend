/**
 * PDF Controller
 */
const path = require('path');
const fs = require('fs-extra');
const { extractBillData, extractBillDataWithAllModels } = require('../services/pdfService');

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../uploads');
fs.ensureDirSync(uploadsDir);

/**
 * Process PDF file to extract bill data
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.processPdf = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        status: 'error',
        message: 'No PDF file provided'
      });
    }

    // Extract bill data from the PDF
    const result = await extractBillData(req.file);

    // Only try to set filename if we got valid data
    if (result.data && typeof result.data === 'object') {
      result.data.Filename = req.file.originalname;

      // Return the extracted data with token usage and pricing information
      return res.status(200).json({
        status: 'success',
        data: result.data,
        usage: result.usage,
        pricing: result.pricing
      });
    } else {
      // If we didn't get valid data, return an error
      return res.status(422).json({
        status: 'error',
        message: 'Failed to extract data from the PDF'
      });
    }
  } catch (error) {
    console.error('PDF processing error:', error);
    return res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to process PDF'
    });
  }
};

/**
 * Process PDF file with all available models and compare results
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.processPdfWithAllModels = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        status: 'error',
        message: 'No PDF file provided'
      });
    }

    // Extract bill data from the PDF using all models
    const results = await extractBillDataWithAllModels(req.file);

    // Add filename to each result's data object if available
    results.forEach(result => {
      if (result.data && typeof result.data === 'object') {
        result.data.Filename = req.file.originalname;
      }
    });

    // Return the results array with data from all models
    return res.status(200).json({
      status: 'success',
      filename: req.file.originalname,
      results
    });
  } catch (error) {
    console.error('PDF multi-model processing error:', error);
    return res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to process PDF with multiple models'
    });
  }
};