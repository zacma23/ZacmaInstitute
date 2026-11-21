export interface RateLimitBucketConfig {
  name: string;
  windowMs: number;
  maxRequests: number;
}

export interface RateLimitResult {
  allowed: boolean;
  bucket: string;
  limit: number;
  remaining: number;
  resetAtEpochSec: number;
  retryAfterSec: number;
}

interface CounterEntry {
  timestamps: number[];
}

const buckets = new Map<string, CounterEntry>();
const MAX_KEYS = 8000;

export const API_RATE_LIMIT_POLICIES: Record<string, RateLimitBucketConfig> = {
  ai: { name: 'ai', windowMs: 60_000, maxRequests: 40 },
  chapa: { name: 'chapa', windowMs: 60_000, maxRequests: 30 },
  session: { name: 'session', windowMs: 60_000, maxRequests: 60 },
  sms: { name: 'sms', windowMs: 60_000, maxRequests: 30 },
  default: { name: 'default', windowMs: 60_000, maxRequests: 120 },
};

export function resolveRateLimitPolicy(routePath: string): RateLimitBucketConfig {
  if (routePath.startsWith('/api/ai/')) return API_RATE_LIMIT_POLICIES.ai;
  if (routePath.startsWith('/api/chapa/')) return API_RATE_LIMIT_POLICIES.chapa;
  if (routePath.startsWith('/api/session/')) return API_RATE_LIMIT_POLICIES.session;
  if (routePath.startsWith('/api/sms/')) return API_RATE_LIMIT_POLICIES.sms;
  return API_RATE_LIMIT_POLICIES.default;
}

export function extractClientIp(
  headers: Record<string, string | string[] | undefined>,
  fallbackIp?: string
): string {
  const fwd = headers['x-forwarded-for'] ?? headers['X-Forwarded-For'];
  const firstFwd = Array.isArray(fwd) ? fwd[0] : fwd;
  if (firstFwd && typeof firstFwd === 'string') {
    const ip = firstFwd.split(',')[0]?.trim();
    if (ip) return ip.slice(0, 64);
  }
  const realIp = headers['x-real-ip'] ?? headers['X-Real-IP'];
  const realIpStr = Array.isArray(realIp) ? realIp[0] : realIp;
  if (realIpStr && typeof realIpStr === 'string') return realIpStr.trim().slice(0, 64);
  return (fallbackIp || '127.0.0.1').slice(0, 64);
}

export function checkApiRateLimit(
  routePath: string,
  clientIp: string,
  nowMs = Date.now()
): RateLimitResult {
  // Health and Chapa webhooks should not be blocked by tight user buckets
  if (routePath === '/api/health' || routePath === '/api/chapa/webhook') {
    return {
      allowed: true,
      bucket: 'exempt',
      limit: 1000,
      remaining: 999,
      resetAtEpochSec: Math.ceil((nowMs + 60_000) / 1000),
      retryAfterSec: 0,
    };
  }

  const policy = resolveRateLimitPolicy(routePath);
  const key = `${policy.name}:${clientIp}`;
  const windowStart = nowMs - policy.windowMs;

  let entry = buckets.get(key);
  if (!entry) {
    if (buckets.size >= MAX_KEYS) {
      const oldestKey = buckets.keys().next().value;
      if (oldestKey) buckets.delete(oldestKey);
    }
    entry = { timestamps: [] };
    buckets.set(key, entry);
  }

  // Prune timestamps outside the sliding window
  entry.timestamps = entry.timestamps.filter((ts) => ts > windowStart);

  if (entry.timestamps.length >= policy.maxRequests) {
    const oldestInWindow = entry.timestamps[0] ?? nowMs;
    const resetMs = oldestInWindow + policy.windowMs;
    const retryAfterSec = Math.max(1, Math.ceil((resetMs - nowMs) / 1000));
    return {
      allowed: false,
      bucket: policy.name,
      limit: policy.maxRequests,
      remaining: 0,
      resetAtEpochSec: Math.ceil(resetMs / 1000),
      retryAfterSec,
    };
  }

  entry.timestamps.push(nowMs);
  const remaining = Math.max(0, policy.maxRequests - entry.timestamps.length);
  return {
    allowed: true,
    bucket: policy.name,
    limit: policy.maxRequests,
    remaining,
    resetAtEpochSec: Math.ceil((nowMs + policy.windowMs) / 1000),
    retryAfterSec: 0,
  };
}

export function buildRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {
    'X-RateLimit-Bucket': result.bucket,
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(result.resetAtEpochSec),
  };
  if (!result.allowed) {
    headers['Retry-After'] = String(result.retryAfterSec);
  }
  return headers;
}
