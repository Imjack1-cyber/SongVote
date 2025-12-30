import { redis } from './redis';

/**
 * Basic Fixed-Window Rate Limiter
 * @param identifier Unique ID (User ID or IP)
 * @param limit Max requests allowed
 * @param windowSeconds Time window in seconds
 * @returns true if allowed, false if limited
 */
export async function checkRateLimit(identifier: string, limit: number, windowSeconds: number): Promise<boolean> {
    const key = `ratelimit:${identifier}`;
    
    try {
        const count = await redis.incr(key);
        
        // If this is the first request, set the expiry
        if (count === 1) {
            await redis.expire(key, windowSeconds);
        }
        
        return count <= limit;
    } catch (error) {
        console.error("Rate Limit Error:", error);
        // Fail open (allow request) if Redis is down to avoid blocking legitimate users
        return true; 
    }
}