// src/services/marketing.service.js
const geoip = require('geoip-lite');
const logger = require('../utils/logger');

class MarketingService {
    constructor() {
        this.geoCache = new Map();
    }

    extractUTMParams(query) {
        return {
            source: query.utm_source || '',
            medium: query.utm_medium || '',
            campaign: query.utm_campaign || '',
            term: query.utm_term || '',
            content: query.utm_content || '',
        };
    }

    extractClickIds(query) {
        return {
            gclid: query.gclid || '',
            fbclid: query.fbclid || '',
            msclkid: query.msclkid || '',
        };
    }

    parseUserAgent(userAgentString) {
        if (!userAgentString) {
            return { name: 'Unknown', version: '', os: 'Unknown' };
        }

        const ua = userAgentString.toLowerCase();
        let name = 'Unknown';
        let version = '';
        let os = 'Unknown';

        if (ua.includes('chrome') && !ua.includes('edg')) {
            name = 'Chrome';
            const match = ua.match(/chrome\/(\d+\.\d+\.\d+\.\d+)/);
            if (match) version = match[1];
        } else if (ua.includes('safari') && !ua.includes('chrome')) {
            name = 'Safari';
            const match = ua.match(/version\/(\d+\.\d+\.\d+)/);
            if (match) version = match[1];
        } else if (ua.includes('firefox')) {
            name = 'Firefox';
            const match = ua.match(/firefox\/(\d+\.\d+)/);
            if (match) version = match[1];
        } else if (ua.includes('edg')) {
            name = 'Edge';
            const match = ua.match(/edg\/(\d+\.\d+\.\d+\.\d+)/);
            if (match) version = match[1];
        } else if (ua.includes('opera') || ua.includes('opr')) {
            name = 'Opera';
            const match = ua.match(/opr\/(\d+\.\d+\.\d+)/);
            if (match) version = match[1];
        }

        if (ua.includes('windows')) {
            os = 'Windows';
            if (ua.includes('windows nt 10.0')) os = 'Windows 10';
            else if (ua.includes('windows nt 6.3')) os = 'Windows 8.1';
            else if (ua.includes('windows nt 6.2')) os = 'Windows 8';
            else if (ua.includes('windows nt 6.1')) os = 'Windows 7';
        } else if (ua.includes('mac os')) {
            os = 'macOS';
        } else if (ua.includes('linux')) {
            os = 'Linux';
        } else if (ua.includes('android')) {
            os = 'Android';
        } else if (ua.includes('ios') || ua.includes('iphone') || ua.includes('ipad')) {
            os = 'iOS';
        }

        return { name, version, os };
    }

    getBrowserInfo(userAgentString, headers) {
        if (!userAgentString) {
            return {
                name: '',
                version: '',
                os: '',
                deviceType: '',
                userAgent: '',
                language: '',
            };
        }

        const parsed = this.parseUserAgent(userAgentString);
        const deviceType = this.detectDeviceType(userAgentString);

        return {
            name: parsed.name || '',
            version: parsed.version || '',
            os: parsed.os || '',
            deviceType: deviceType,
            userAgent: userAgentString || '',
            language: headers['accept-language'] || '',
        };
    }

    detectDeviceType(userAgent) {
        if (!userAgent) return 'desktop';

        const ua = userAgent.toLowerCase();
        if (/(tablet|ipad|playbook|kindle)/i.test(ua)) return 'tablet';
        if (/(mobile|iphone|ipod|android|blackberry|windows phone)/i.test(ua)) return 'mobile';
        return 'desktop';
    }

    getGeoInfo(ip) {
        if (!ip || ip === '::1' || ip === '127.0.0.1' || ip === 'localhost') {
            return {
                ip: ip || '',
                country: '',
                region: '',
                city: '',
                latitude: null,
                longitude: null,
                timezone: '',
            };
        }

        if (this.geoCache.has(ip)) {
            return this.geoCache.get(ip);
        }

        try {
            const geo = geoip.lookup(ip);

            let result = {
                ip: ip,
                country: geo?.country || '',
                region: geo?.region || '',
                city: geo?.city || '',
                latitude: geo?.ll?.[0] || null,
                longitude: geo?.ll?.[1] || null,
                timezone: geo?.timezone || '',
            };

            this.geoCache.set(ip, result);
            return result;
        } catch (error) {
            logger.error('GeoIP lookup error:', error);
            return {
                ip: ip,
                country: '',
                region: '',
                city: '',
                latitude: null,
                longitude: null,
                timezone: '',
            };
        }
    }

    getPageInfo(req) {
        return {
            referrer: req.headers.referer || req.headers.referrer || '',
            landingPage: req.headers['x-landing-page'] || req.headers['x-original-url'] || '',
            currentPage: req.originalUrl || req.url || '',
        };
    }

    getClientIP(req) {
        const forwarded = req.headers['x-forwarded-for'];
        if (forwarded) {
            const ips = forwarded.split(',').map(ip => ip.trim());
            return ips[0] || req.connection.remoteAddress || req.ip || '';
        }

        return req.ip || req.connection.remoteAddress || req.socket.remoteAddress || '';
    }

    collectMarketingData(req) {
        try {
            const query = req.query || {};
            const headers = req.headers || {};
            const userAgent = headers['user-agent'] || '';

            const ip = this.getClientIP(req);

            const marketingData = {
                utm: this.extractUTMParams(query),
                clickIds: this.extractClickIds(query),
                geo: this.getGeoInfo(ip),
                browser: this.getBrowserInfo(userAgent, headers),
                page: this.getPageInfo(req),
                sessionId: headers['x-session-id'] || req.params.sessionId || '',
                timestamp: new Date(),
                // Add cookie consent data if available
                consent: headers['x-cookie-consent'] ? JSON.parse(headers['x-cookie-consent']) : null,
            };

            logger.debug('Marketing data collected:', {
                sessionId: marketingData.sessionId,
                utmSource: marketingData.utm.source,
                country: marketingData.geo.country,
                deviceType: marketingData.browser.deviceType,
                hasConsent: !!marketingData.consent,
            });

            return marketingData;
        } catch (error) {
            logger.error('Error collecting marketing data:', error);
            return {
                utm: { source: '', medium: '', campaign: '', term: '', content: '' },
                clickIds: { gclid: '', fbclid: '', msclkid: '' },
                geo: { ip: '', country: '', region: '', city: '', latitude: null, longitude: null, timezone: '' },
                browser: { name: '', version: '', os: '', deviceType: '', userAgent: '', language: '' },
                page: { referrer: '', landingPage: '', currentPage: '' },
                sessionId: '',
                timestamp: new Date(),
                consent: null,
            };
        }
    }

    formatForZoho(marketingData) {
        return {
            utm_source: marketingData.utm.source || '',
            utm_medium: marketingData.utm.medium || '',
            utm_campaign: marketingData.utm.campaign || '',
            utm_term: marketingData.utm.term || '',
            utm_content: marketingData.utm.content || '',
            gclid: marketingData.clickIds.gclid || '',
            fbclid: marketingData.clickIds.fbclid || '',
            msclkid: marketingData.clickIds.msclkid || '',
            visitor_ip: marketingData.geo.ip || '',
            visitor_country: marketingData.geo.country || '',
            visitor_region: marketingData.geo.region || '',
            visitor_city: marketingData.geo.city || '',
            visitor_latitude: marketingData.geo.latitude || '',
            visitor_longitude: marketingData.geo.longitude || '',
            visitor_timezone: marketingData.geo.timezone || '',
            browser_name: marketingData.browser.name || '',
            browser_version: marketingData.browser.version || '',
            operating_system: marketingData.browser.os || '',
            device_type: marketingData.browser.deviceType || '',
            user_agent: marketingData.browser.userAgent || '',
            browser_language: marketingData.browser.language || '',
            referrer: marketingData.page.referrer || '',
            landing_page: marketingData.page.landingPage || '',
            current_page: marketingData.page.currentPage || '',
            session_id: marketingData.sessionId || '',
            timestamp: marketingData.timestamp ? new Date(marketingData.timestamp).toISOString() : '',
            // Cookie consent data
            cookie_consent_given: marketingData.consent ? 'true' : 'false',
            cookie_analytics_consent: marketingData.consent?.analytics ? 'true' : 'false',
            cookie_marketing_consent: marketingData.consent?.marketing ? 'true' : 'false',
            cookie_performance_consent: marketingData.consent?.performance ? 'true' : 'false',
        };
    }
}

module.exports = new MarketingService();