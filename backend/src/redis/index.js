const Redis = require('ioredis');
require('dotenv').config();

let redisClient = null;

function getRedisClient() {
  if (!redisClient) {
    const redisUrl = process.env.REDIS_URL;

    if (redisUrl) {
      try {
        redisClient = new Redis(redisUrl, {
          maxRetriesPerRequest: 3,
          enableReadyCheck: false,
          retryStrategy(times) {
            const delay = Math.min(times * 200, 2000);
            return delay;
          },
        });

        redisClient.on('connect', () => {
          console.log('[ClassPulse Redis] Successfully connected to Upstash Redis');
        });

        redisClient.on('error', (err) => {
          console.warn('[ClassPulse Redis] Redis connection warning:', err.message);
        });
      } catch (err) {
        console.warn('[ClassPulse Redis] Failed to initialize Redis client, falling back:', err.message);
        redisClient = createInMemoryFallback();
      }
    } else {
      console.warn('[ClassPulse Redis] REDIS_URL not set, using in-memory cache fallback');
      redisClient = createInMemoryFallback();
    }
  }

  return redisClient;
}

// In-memory fallback if Redis is unreachable in offline development
function createInMemoryFallback() {
  const store = new Map();
  const timeouts = new Map();

  return {
    async set(key, value, mode, duration) {
      store.set(key, value);
      if (timeouts.has(key)) clearTimeout(timeouts.get(key));
      if (mode === 'EX' && duration) {
        const timeout = setTimeout(() => {
          store.delete(key);
          timeouts.delete(key);
        }, duration * 1000);
        timeouts.set(key, timeout);
      }
      return 'OK';
    },
    async get(key) {
      return store.get(key) || null;
    },
    async del(key) {
      if (timeouts.has(key)) clearTimeout(timeouts.get(key));
      timeouts.delete(key);
      return store.delete(key) ? 1 : 0;
    },
  };
}

module.exports = {
  getRedisClient,
};
