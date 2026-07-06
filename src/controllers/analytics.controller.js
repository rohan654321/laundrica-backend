// src/controllers/analytics.controller.js
const analyticsService = require('../services/analytics.service');
const logger = require('../utils/logger');

exports.trackEvent = async (req, res, next) => {
    try {
        const { eventType, eventData, consent } = req.body;

        if (!eventType) {
            const error = new Error('Event type is required');
            error.statusCode = 400;
            throw error;
        }

        const result = await analyticsService.trackEvent(eventType, req, eventData, consent);

        res.status(200).json({
            success: true,
            message: 'Event tracked successfully',
            data: result,
        });
    } catch (error) {
        next(error);
    }
};

exports.getAnalyticsBySession = async (req, res, next) => {
    try {
        const { sessionId } = req.params;
        const { limit = 100 } = req.query;

        const analytics = await analyticsService.getAnalyticsBySession(sessionId, parseInt(limit));

        res.status(200).json({
            success: true,
            analytics,
            count: analytics.length,
        });
    } catch (error) {
        next(error);
    }
};

exports.getAnalyticsSummary = async (req, res, next) => {
    try {
        const { sessionId, startDate, endDate } = req.query;

        if (!sessionId) {
            const error = new Error('Session ID is required');
            error.statusCode = 400;
            throw error;
        }

        const summary = await analyticsService.getAnalyticsBySession(sessionId);

        res.status(200).json({
            success: true,
            summary,
        });
    } catch (error) {
        next(error);
    }
};

exports.getEventAnalytics = async (req, res, next) => {
    try {
        const { eventType } = req.params;
        const { startDate, endDate } = req.query;

        if (!startDate || !endDate) {
            const error = new Error('Start date and end date are required');
            error.statusCode = 400;
            throw error;
        }

        const results = await analyticsService.getAnalyticsByEvent(
            eventType,
            startDate,
            endDate
        );

        res.status(200).json({
            success: true,
            data: results,
        });
    } catch (error) {
        next(error);
    }
};