// src/models/Analytics.js
const mongoose = require('mongoose');

const analyticsSchema = new mongoose.Schema(
    {
        sessionId: {
            type: String,
            required: true,
            index: true,
        },
        eventType: {
            type: String,
            enum: [
                'page_view',
                'consent_given',
                'consent_rejected',
                'consent_customized',
                'order_placed',
                'cart_added',
                'product_viewed',
                'search_performed',
                'checkout_started',
                'payment_completed',
            ],
            required: true,
            index: true,
        },
        eventData: {
            type: mongoose.Schema.Types.Mixed,
            default: {},
        },
        marketing: {
            utm: {
                source: { type: String, default: '' },
                medium: { type: String, default: '' },
                campaign: { type: String, default: '' },
                term: { type: String, default: '' },
                content: { type: String, default: '' },
            },
            clickIds: {
                gclid: { type: String, default: '' },
                fbclid: { type: String, default: '' },
                msclkid: { type: String, default: '' },
            },
            geo: {
                ip: { type: String, default: '' },
                country: { type: String, default: '' },
                region: { type: String, default: '' },
                city: { type: String, default: '' },
                latitude: { type: Number, default: null },
                longitude: { type: Number, default: null },
                timezone: { type: String, default: '' },
            },
            browser: {
                name: { type: String, default: '' },
                version: { type: String, default: '' },
                os: { type: String, default: '' },
                deviceType: { type: String, default: '' },
                userAgent: { type: String, default: '' },
                language: { type: String, default: '' },
            },
            page: {
                referrer: { type: String, default: '' },
                landingPage: { type: String, default: '' },
                currentPage: { type: String, default: '' },
            },
        },
        consent: {
            given: { type: Boolean, default: false },
            analytics: { type: Boolean, default: false },
            marketing: { type: Boolean, default: false },
            performance: { type: Boolean, default: false },
        },
        syncedToZoho: {
            type: Boolean,
            default: false,
            index: true,
        },
        zohoSyncDate: {
            type: Date,
            default: null,
        },
        zohoError: {
            type: String,
            default: null,
        },
    },
    {
        timestamps: true,
        collection: 'analytics',
    }
);

// Indexes for better query performance
analyticsSchema.index({ sessionId: 1, eventType: 1, createdAt: -1 });
analyticsSchema.index({ 'marketing.utm.source': 1 });
analyticsSchema.index({ 'marketing.geo.country': 1 });
analyticsSchema.index({ syncedToZoho: 1 });

// Static method to get analytics summary
analyticsSchema.statics.getSummary = async function (sessionId, startDate, endDate) {
    const match = {
        sessionId: sessionId,
        createdAt: {
            $gte: new Date(startDate),
            $lte: new Date(endDate),
        },
    };

    const summary = await this.aggregate([
        { $match: match },
        {
            $group: {
                _id: '$eventType',
                count: { $sum: 1 },
                uniqueSessions: { $addToSet: '$sessionId' },
            },
        },
        {
            $project: {
                eventType: '$_id',
                count: 1,
                uniqueSessions: { $size: '$uniqueSessions' },
                _id: 0,
            },
        },
    ]);

    return summary;
};

module.exports = mongoose.model('Analytics', analyticsSchema);