// Copyright (c) 2026 Ironfeast Media, LLC. All rights reserved.
interface RateLimitEntry {
  count: number
  resetAt: number
}

const memoryStore = new Map<string, RateLimitEntry>()

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

    reset(identifier: string): void {
      memoryStore.delete(identifier)
    },

    clear(): void {
      memoryStore.clear()
    },
  }
}

export const waitlistRateLimiter = createRateLimiter({
  maxRequests: 5,
  windowMs: 60_000,
})