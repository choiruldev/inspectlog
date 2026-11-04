// Simple sliding window rate limiter in memory / IP based
const ipRequests = new Map<string, number[]>();

export function checkRateLimit(ip: string, limit = 10, windowMs = 60 * 60 * 1000): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const timestamps = ipRequests.get(ip) || [];

  // Remove timestamps older than window
  const validTimestamps = timestamps.filter((t) => now - t < windowMs);

  if (validTimestamps.length >= limit) {
    ipRequests.set(ip, validTimestamps);
    return { allowed: false, remaining: 0 };
  }

  validTimestamps.push(now);
  ipRequests.set(ip, validTimestamps);

  return { allowed: true, remaining: limit - validTimestamps.length };
}
