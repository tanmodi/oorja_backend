/**
 * Index controller
 */

const indexService = require('../services/indexService');

/**
 * Get index handler
 */
exports.getIndex = async (req, res, next) => {
  try {
    const message = indexService.getWelcomeMessage();
    return res.status(200).json({
      status: 'success',
      message
    });
  } catch (error) {
    next(error);
  }
};