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
  startCleanupInterval(config.windowMs)

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

    reset(identifier: string): void {
      memoryStore.delete(identifier)
    },

    clear(): void {
      memoryStore.clear()
    },

    stopCleanup(): void {
      stopCleanupInterval()
    },
  }
}

export const waitlistRateLimiter = createRateLimiter({
  maxRequests: 5,
  windowMs: 60_000,
})