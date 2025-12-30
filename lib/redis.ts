import Redis from 'ioredis';

const getRedisUrl = () => {
  if (process.env.REDIS_URL) return process.env.REDIS_URL;
  return 'redis://localhost:6379';
};

// Create a singleton instance to prevent multiple connections in dev
const globalForRedis = global as unknown as { redis: Redis };

export const redis = globalForRedis.redis || new Redis(getRedisUrl());

// Handle connection errors gracefully (e.g. if Redis isn't running in dev)
redis.on('error', (err) => {
    // Suppress connection refused errors in console during dev to keep log clean
    if ((err as any).code !== 'ECONNREFUSED') {
        console.error('Redis Client Error', err);
    }
});

if (process.env.NODE_ENV !== 'production') globalForRedis.redis = redis;