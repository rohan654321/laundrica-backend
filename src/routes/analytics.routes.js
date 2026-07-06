// src/routes/analytics.routes.js
const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analytics.controller');
const { standardLimiter } = require('../middleware/rateLimit');

// Track an event
router.post('/track', standardLimiter, analyticsController.trackEvent);

// Get analytics by session
router.get('/session/:sessionId', standardLimiter, analyticsController.getAnalyticsBySession);

// Get analytics summary
router.get('/summary', standardLimiter, analyticsController.getAnalyticsSummary);

// Get event analytics
router.get('/event/:eventType', standardLimiter, analyticsController.getEventAnalytics);

module.exports = router;