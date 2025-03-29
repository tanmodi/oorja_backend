/**
 * Utility functions for the application
 */

/**
 * Formats date to a standard format
 * @param {Date} date - Date to format
 * @returns {string} Formatted date string
 */
exports.formatDate = (date = new Date()) => {
  return date.toISOString();
};

/**
 * Creates a standardized API response
 * @param {string} status - Response status ('success' or 'error')
 * @param {any} data - Response data
 * @param {string} message - Response message
 * @returns {Object} Standardized response object
 */
exports.createResponse = (status = 'success', data = null, message = '') => {
  return {
    status,
    timestamp: exports.formatDate(),
    data,
    message
  };
};

/**
 * Validates an email address format
 * @param {string} email - Email to validate
 * @returns {boolean} Whether the email is valid
 */
exports.isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};