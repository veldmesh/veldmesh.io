// Copyright (c) 2026 Ironfeast Media, LLC. All rights reserved.
// In-memory token bucket, keyed by client IP.
// State is per-instance: on a single VPS (or one long-lived Node process)
// the limit is global, but on serverless platforms each instance enforces
// its own bucket. This is a best-effort abuse guard, not a hard guarantee.
export const RATE_LIMIT_CAPACITY = 5
export const RATE_LIMIT_REFILL_MS = 60_000

// A bucket idle for >= RATE_LIMIT_CAPACITY refill intervals is completely
// refilled, so evicting it is indistinguishable from keeping it. Sweeping
// such buckets keeps the map bounded to recently active clients instead of
// growing forever with every unique IP ever seen.
const STALE_BUCKET_MS = RATE_LIMIT_CAPACITY * RATE_LIMIT_REFILL_MS
const SWEEP_INTERVAL_MS = RATE_LIMIT_REFILL_MS

interface Bucket {
  tokens: number
  lastRefill: number
}

const buckets = new Map<string, Bucket>()
let lastSweep = 0

// Observability: number of client buckets currently tracked.
export function rateLimitBucketCount(): number {
  return buckets.size
}

function sweepStaleBuckets(now: number): void {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return
  lastSweep = now
  for (const [key, bucket] of buckets) {
    if (now - bucket.lastRefill >= STALE_BUCKET_MS) buckets.delete(key)
  }
}

export function checkRateLimit(key: string, now: number): boolean {
  sweepStaleBuckets(now)

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
