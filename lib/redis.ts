import Redis from 'ioredis';
import { logger } from './logger';

const getRedisUrl = () => {
  if (process.env.REDIS_URL) return process.env.REDIS_URL;
  return 'redis://localhost:6379';
};

// Create a singleton instance to prevent multiple connections in dev
const globalForRedis = global as unknown as { redis: Redis };

export const redis = globalForRedis.redis || new Redis(getRedisUrl());

redis.on('error', (err) => {
    // Suppress connection refused errors in console during dev to keep log clean
    if ((err as any).code !== 'ECONNREFUSED') {
        logger.error({ err, source: 'redis_main' }, 'Redis Client Error');
    }
});

redis.on('connect', () => {
    // Only log in dev or if this is a fresh connection in prod
    if (process.env.NODE_ENV !== 'production' || !globalForRedis.redis) {
        logger.info({ source: 'redis_main' }, 'Redis Connected');
    }
});

if (process.env.NODE_ENV !== 'production') globalForRedis.redis = redis;