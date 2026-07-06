// src/workers/zoho-analytics.worker.js
const queues = require('../config/bull');
const Analytics = require('../models/Analytics');
const analyticsService = require('../services/analytics.service');
const logger = require('../utils/logger');

// Process Zoho analytics sync jobs
queues.zohoAnalytics.process(async (job) => {
    const { analyticsId } = job.data;

    logger.info(`Processing Zoho analytics sync for ID: ${analyticsId}`);

    try {
        const analyticsEntry = await Analytics.findById(analyticsId);
        if (!analyticsEntry) {
            throw new Error(`Analytics entry ${analyticsId} not found`);
        }

        // Skip if already synced
        if (analyticsEntry.syncedToZoho) {
            logger.info(`Analytics ${analyticsId} already synced to Zoho`);
            return { success: true, alreadySynced: true };
        }

        const result = await analyticsService.syncToZoho(analyticsEntry);

        if (result) {
            logger.info(`Analytics ${analyticsId} synced to Zoho successfully`);
        } else {
            throw new Error('Failed to sync to Zoho');
        }

        return { success: true };
    } catch (error) {
        logger.error(`Zoho analytics sync job failed for ${analyticsId}:`, error);
        throw error;
    }
});

// Handle failed jobs
queues.zohoAnalytics.on('failed', (job, error) => {
    logger.error(`Zoho analytics job ${job.id} failed after ${job.attemptsMade} attempts:`, error);
});

module.exports = queues.zohoAnalytics;