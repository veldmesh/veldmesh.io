// Copyright (c) 2026 Ironfeast Media, LLC. All rights reserved.
// In-memory token bucket, keyed by client IP.
// State is per-instance: on a single VPS (or one long-lived Node process)
// the limit is global, but on serverless platforms each instance enforces
// its own bucket. This is a best-effort abuse guard, not a hard guarantee.
export const RATE_LIMIT_CAPACITY = 5
export const RATE_LIMIT_REFILL_MS = 60_000

interface Bucket {
  tokens: number
  lastRefill: number
}

const buckets = new Map<string, Bucket>()

export function checkRateLimit(key: string, now: number): boolean {
  let bucket = buckets.get(key)
  if (!bucket) {
    bucket = { tokens: RATE_LIMIT_CAPACITY, lastRefill: now }
    buckets.set(key, bucket)
  }

  const elapsed = now - bucket.lastRefill
  if (elapsed >= RATE_LIMIT_REFILL_MS) {
    const refills = Math.floor(elapsed / RATE_LIMIT_REFILL_MS)
    bucket.tokens = Math.min(RATE_LIMIT_CAPACITY, bucket.tokens + refills)
    bucket.lastRefill += refills * RATE_LIMIT_REFILL_MS
  }

  if (bucket.tokens < 1) return false
  bucket.tokens -= 1
  return true
}
