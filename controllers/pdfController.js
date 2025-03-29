/**
 * PDF Controller
 */
const path = require('path');
const fs = require('fs-extra');
const { extractBillData } = require('../services/pdfService');

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

      // Return the extracted data with token usage
      return res.status(200).json({
        status: 'success',
        data: result.data,
        usage: result.usage
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