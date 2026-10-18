// Copyright (c) 2026 Ironfeast Media, LLC. All rights reserved.
/**
 * In-memory rate limiter for waitlist signups.
 *
 * LIMITATION: This implementation uses an in-memory Map and is NOT shared across
 * multiple processes or containers. In a multi-instance deployment (e.g., Vercel,
 * Kubernetes, multiple Docker containers), each instance maintains its own rate
 * limit state, allowing up to maxRequests per instance per IP per window.
 *
 * For multi-instance deployments, use a Redis-backed implementation instead.
 * Set REDIS_URL environment variable to enable Redis support (not yet implemented).
 *
 * The rate limiter is designed for single-instance deployments where the API route
 * and background worker run in the same process or share the same memory space.
 */

interface RateLimitEntry {
  count: number
  resetAt: number
}

const memoryStore = new Map<string, RateLimitEntry>()
const mutexStore = new Map<string, Promise<RateLimitResult>>()

let cleanupInterval: NodeJS.Timeout | null = null

function startCleanupInterval(windowMs: number): void {
  if (cleanupInterval) return
  cleanupInterval = setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of memoryStore.entries()) {
      if (now > entry.resetAt) {
        memoryStore.delete(key)
      }
    }
  }, windowMs)
}

function stopCleanupInterval(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval)
    cleanupInterval = null
  }
}

export interface RateLimitConfig {
  maxRequests: number
  windowMs: number
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
}

export function createRateLimiter(config: RateLimitConfig) {
  return {
    check(identifier: string): RateLimitResult {
      const now = Date.now()
      const entry = memoryStore.get(identifier)

      if (!entry || now > entry.resetAt) {
        const resetAt = now + config.windowMs
        memoryStore.set(identifier, { count: 1, resetAt })
        return { allowed: true, remaining: config.maxRequests - 1, resetAt }
      }

      if (entry.count >= config.maxRequests) {
        return { allowed: false, remaining: 0, resetAt: entry.resetAt }
      }

      entry.count++
      return { allowed: true, remaining: config.maxRequests - entry.count, resetAt: entry.resetAt }
    },

    /** Check with a per-identifier mutex to serialize concurrent checks. */
    async checkAsync(identifier: string): Promise<RateLimitResult> {
      // Chain onto any in-flight check for this identifier
      const previous = mutexStore.get(identifier) ?? Promise.resolve()
      const current = previous.then(() => this.check(identifier))
      mutexStore.set(identifier, current)

      try {
        return await current
      } finally {
        // Clean up if this is still the latest promise
        if (mutexStore.get(identifier) === current) {
          mutexStore.delete(identifier)
        }
      }
    },

    reset(identifier: string): void {
      memoryStore.delete(identifier)
    },

    clear(): void {
      memoryStore.clear()
      mutexStore.clear()
    },
  }
}

export const waitlistRateLimiter = createRateLimiter({
  maxRequests: 5,
  windowMs: 60_000,
})

/** Start the cleanup interval (call once at worker/app startup). */
export function startRateLimitCleanup(): void {
  startCleanupInterval(60_000)
}

/** Stop the cleanup interval. */
export function stopRateLimitCleanup(): void {
  stopCleanupInterval()
}

// Auto-start cleanup for long-running processes (e.g., Next.js dev server, Docker).
// In serverless environments the process exits before the interval fires, so
// this is effectively a no-op there.
if (typeof process !== "undefined" && process.env.NODE_ENV !== "test") {
  startRateLimitCleanup()
}