// src/services/analytics.service.js
const Analytics = require('../models/Analytics');
const queues = require('../config/bull');
const logger = require('../utils/logger');
const marketingService = require('./marketing.service');

class AnalyticsService {
    async trackEvent(eventType, req, eventData = {}, consent = null) {
        try {
            const marketingData = marketingService.collectMarketingData(req);

            // Get consent from headers or use provided consent
            const consentData = consent ||
                (req.headers['x-cookie-consent'] ? JSON.parse(req.headers['x-cookie-consent']) : null);

            const analyticsEntry = new Analytics({
                sessionId: marketingData.sessionId || req.headers['x-session-id'] || '',
                eventType: eventType,
                eventData: eventData,
                marketing: {
                    utm: marketingData.utm,
                    clickIds: marketingData.clickIds,
                    geo: marketingData.geo,
                    browser: marketingData.browser,
                    page: marketingData.page,
                },
                consent: {
                    given: !!consentData,
                    analytics: consentData?.analytics || false,
                    marketing: consentData?.marketing || false,
                    performance: consentData?.performance || false,
                },
                syncedToZoho: false,
            });

            await analyticsEntry.save();
            logger.debug(`Analytics event tracked: ${eventType}`);

            // Queue for Zoho sync if consent is given
            if (consentData?.analytics || consentData?.marketing) {
                await this.queueForZohoSync(analyticsEntry);
            }

            return analyticsEntry;
        } catch (error) {
            logger.error('Error tracking analytics event:', error);
            // Don't throw - analytics should not break the main flow
            return null;
        }
    }

    async queueForZohoSync(analyticsEntry) {
        try {
            await queues.zohoAnalytics.add({
                analyticsId: analyticsEntry._id,
                sessionId: analyticsEntry.sessionId,
                eventType: analyticsEntry.eventType,
                eventData: analyticsEntry.eventData,
                marketing: analyticsEntry.marketing,
                consent: analyticsEntry.consent,
            }, {
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 2000,
                },
            });
            logger.debug(`Analytics event queued for Zoho sync: ${analyticsEntry.eventType}`);
        } catch (error) {
            logger.error('Failed to queue analytics for Zoho sync:', error);
        }
    }

    async syncToZoho(analyticsEntry) {
        try {
            const zohoPayload = {
                event_type: analyticsEntry.eventType,
                event_data: analyticsEntry.eventData,
                timestamp: analyticsEntry.createdAt,
                session_id: analyticsEntry.sessionId,
                ...marketingService.formatForZoho(analyticsEntry.marketing),
                consent_given: analyticsEntry.consent.given,
                consent_analytics: analyticsEntry.consent.analytics,
                consent_marketing: analyticsEntry.consent.marketing,
                consent_performance: analyticsEntry.consent.performance,
            };

            // Send to Zoho Webhook
            const response = await fetch(process.env.ZOHO_ANALYTICS_WEBHOOK_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify(zohoPayload),
            });

            if (!response.ok) {
                throw new Error(`Zoho sync failed: ${response.status}`);
            }

            // Update the record
            await Analytics.findByIdAndUpdate(analyticsEntry._id, {
                syncedToZoho: true,
                zohoSyncDate: new Date(),
            });

            logger.debug(`Analytics synced to Zoho: ${analyticsEntry.eventType}`);
            return true;
        } catch (error) {
            logger.error('Error syncing analytics to Zoho:', error);

            await Analytics.findByIdAndUpdate(analyticsEntry._id, {
                zohoError: error.message,
            });

            return false;
        }
    }

    async getAnalyticsBySession(sessionId, limit = 100) {
        return await Analytics.find({ sessionId })
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean();
    }

    async getAnalyticsByEvent(eventType, startDate, endDate) {
        const match = {
            eventType: eventType,
            createdAt: {
                $gte: new Date(startDate),
                $lte: new Date(endDate),
            },
        };

        return await Analytics.aggregate([
            { $match: match },
            {
                $group: {
                    _id: {
                        date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                        country: '$marketing.geo.country',
                    },
                    count: { $sum: 1 },
                    uniqueSessions: { $addToSet: '$sessionId' },
                },
            },
            {
                $project: {
                    date: '$_id.date',
                    country: '$_id.country',
                    count: 1,
                    uniqueSessions: { $size: '$uniqueSessions' },
                    _id: 0,
                },
            },
            { $sort: { date: 1 } },
        ]);
    }
}

module.exports = new AnalyticsService();