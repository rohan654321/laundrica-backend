// src/config/bull.js
const Queue = require('bull');
const logger = require('../utils/logger');

const createQueue = (name, options = {}) => {
    try {
        const queue = new Queue(name, {
            redis: {
                // YOUR REDIS CLOUD CREDENTIALS - HARDCODED
                host: 'redis-12286.crce309.us-east-1-6.ec2.cloud.redislabs.com',
                port: 12286,
                password: 'APfUWs5BF8iGpYgF6P0xwAdkal9ic5rF',
                username: 'default',
                connectTimeout: 10000,
                // DISABLE TLS
                tls: null,
                retryStrategy: (times) => {
                    if (times > 3) {
                        logger.warn(`Queue ${name}: Max retries reached, stopping retries`);
                        return null;
                    }
                    return Math.min(times * 1000, 5000);
                },
            },
            defaultJobOptions: {
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 1000,
                },
                removeOnComplete: 100,
                removeOnFail: 200,
                timeout: 30000,
                ...options.defaultJobOptions,
            },
            ...options,
        });

        queue.on('error', (error) => {
            logger.error(`Queue ${name} error:`, error.message);
        });

        queue.on('failed', (job, error) => {
            logger.error(`Queue ${name} job ${job.id} failed:`, error.message);
        });

        queue.on('completed', (job) => {
            logger.info(`Queue ${name} job ${job.id} completed`);
        });

        return queue;
    } catch (error) {
        logger.warn(`Queue ${name} initialization failed:`, error.message);
        return {
            add: async () => ({ id: 'mock-' + Date.now() }),
            process: () => { },
            on: () => { },
            close: async () => { },
        };
    }
};

const queues = {
    orderProcessing: createQueue('order-processing'),
    zohoWebhook: createQueue('zoho-webhook'),
    emailNotifications: createQueue('email-notifications'),
    orderCleanup: createQueue('order-cleanup'),
    zohoAnalytics: createQueue('zoho-analytics'),
};

module.exports = queues;