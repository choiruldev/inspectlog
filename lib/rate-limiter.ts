// Sliding window rate limiter in memory with automatic key cleanup
const rateLimits = new Map<string, number[]>();

// Periodically clean up expired timestamps every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamps] of rateLimits.entries()) {
    const fresh = timestamps.filter((t) => now - t < 3600000);
    if (fresh.length === 0) {
      rateLimits.delete(key);
    } else {
      rateLimits.set(key, fresh);
    }
  }
}, 10 * 60 * 1000).unref();

export function checkRateLimit(
  key: string,
  limit = 10,
  windowMs = 60 * 60 * 1000
): { allowed: boolean; remaining: number; retryAfterSeconds?: number } {
  const now = Date.now();
  const timestamps = rateLimits.get(key) || [];

  // Remove timestamps older than window
  const validTimestamps = timestamps.filter((t) => now - t < windowMs);

  if (validTimestamps.length >= limit) {
    rateLimits.set(key, validTimestamps);
    const oldestTimestamp = validTimestamps[0];
    const retryAfterSeconds = Math.ceil((oldestTimestamp + windowMs - now) / 1000);
    return { allowed: false, remaining: 0, retryAfterSeconds: Math.max(1, retryAfterSeconds) };
  }

  validTimestamps.push(now);
  rateLimits.set(key, validTimestamps);

  return { allowed: true, remaining: limit - validTimestamps.length };
}
