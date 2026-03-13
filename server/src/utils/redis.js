const Redis = require('ioredis');

let redis = null;

const redisUrl = process.env.REDIS_URL;

if (redisUrl) {
  redis = new Redis(redisUrl, {
    maxRetriesPerRequest: null, // required by BullMQ
  });

  redis.on('error', (err) => {
    console.error('[Redis] connection error:', err.message);
  });

  redis.on('connect', () => {
    console.log('[Redis] connected');
  });
} else {
  console.warn('[Redis] REDIS_URL not set — Redis/BullMQ features disabled');
}

module.exports = redis;
