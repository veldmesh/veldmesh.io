// Copyright (c) 2026 Ironfeast Media, LLC. All rights reserved.
import { describe, it, expect, beforeEach, vi } from "vitest"
import { createRateLimiter, waitlistRateLimiter, startRateLimitCleanup, stopRateLimitCleanup } from "@/lib/rate-limit"

describe("createRateLimiter", () => {
  let limiter: ReturnType<typeof createRateLimiter>

  beforeEach(() => {
    limiter = createRateLimiter({ maxRequests: 3, windowMs: 60_000 })
  })

  it("allows requests under the limit", () => {
    const result1 = limiter.check("ip-1")
    expect(result1.allowed).toBe(true)
    expect(result1.remaining).toBe(2)

    const result2 = limiter.check("ip-1")
    expect(result2.allowed).toBe(true)
    expect(result2.remaining).toBe(1)

    const result3 = limiter.check("ip-1")
    expect(result3.allowed).toBe(true)
    expect(result3.remaining).toBe(0)
  })

  it("blocks requests over the limit", () => {
    limiter.check("ip-2")
    limiter.check("ip-2")
    limiter.check("ip-2")

    const result = limiter.check("ip-2")
    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
  })

  it("tracks different identifiers separately", () => {
    limiter.check("ip-a")
    limiter.check("ip-a")
    limiter.check("ip-a")

    const result = limiter.check("ip-b")
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(2)
  })

  it("resets after window expires", () => {
    vi.useFakeTimers()
    try {
      limiter.check("ip-3")
      limiter.check("ip-3")
      limiter.check("ip-3")

      expect(limiter.check("ip-3").allowed).toBe(false)

      vi.advanceTimersByTime(61_000)

      const result = limiter.check("ip-3")
      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(2)
    } finally {
      vi.useRealTimers()
    }
  })

  it("reset clears the entry", () => {
    limiter.check("ip-4")
    limiter.check("ip-4")
    limiter.reset("ip-4")

    const result = limiter.check("ip-4")
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(2)
  })

  it("clear removes all entries", () => {
    limiter.check("ip-5")
    limiter.check("ip-6")
    limiter.clear()

    expect(limiter.check("ip-5").remaining).toBe(2)
    expect(limiter.check("ip-6").remaining).toBe(2)
  })

  it("cleanup interval removes expired entries", () => {
    vi.useFakeTimers()
    try {
      limiter.check("ip-7")
      limiter.check("ip-8")
      limiter.check("ip-9")

      // Advance time past window
      vi.advanceTimersByTime(61_000)

      // Trigger cleanup by advancing the cleanup interval
      vi.advanceTimersByTime(60_000)

      // New requests should work fine (expired entries cleaned up)
      const result = limiter.check("ip-7")
      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(2)
    } finally {
      vi.useRealTimers()
    }
  })

  it("stopRateLimitCleanup stops the cleanup interval without throwing", () => {
    startRateLimitCleanup()
    expect(() => stopRateLimitCleanup()).not.toThrow()
    // Calling again should not throw
    expect(() => stopRateLimitCleanup()).not.toThrow()
  })

  describe("checkAsync (mutex-protected)", () => {
    it("serializes concurrent checks for the same identifier", async () => {
      const asyncLimiter = createRateLimiter({ maxRequests: 2, windowMs: 60_000 })
      const results = await Promise.all([
        asyncLimiter.checkAsync("async-ip"),
        asyncLimiter.checkAsync("async-ip"),
        asyncLimiter.checkAsync("async-ip"),
      ])

      // First two allowed, third blocked
      expect(results.filter((r) => r.allowed)).toHaveLength(2)
      expect(results.filter((r) => !r.allowed)).toHaveLength(1)
      expect(results[2].allowed).toBe(false)
    })

    it("allows concurrent checks for different identifiers", async () => {
      const asyncLimiter = createRateLimiter({ maxRequests: 1, windowMs: 60_000 })
      const results = await Promise.all([
        asyncLimiter.checkAsync("async-ip-a"),
        asyncLimiter.checkAsync("async-ip-b"),
      ])

      expect(results[0].allowed).toBe(true)
      expect(results[1].allowed).toBe(true)
    })

    it("works correctly with sequential and concurrent mix", async () => {
      const asyncLimiter = createRateLimiter({ maxRequests: 3, windowMs: 60_000 })

      // First request
      const r1 = await asyncLimiter.checkAsync("mixed-ip")
      expect(r1.allowed).toBe(true)
      expect(r1.remaining).toBe(2)

      // Two concurrent requests
      const [r2, r3] = await Promise.all([
        asyncLimiter.checkAsync("mixed-ip"),
        asyncLimiter.checkAsync("mixed-ip"),
      ])
      expect(r2.allowed).toBe(true)
      expect(r3.allowed).toBe(true)

      // Fourth request should be blocked
      const r4 = await asyncLimiter.checkAsync("mixed-ip")
      expect(r4.allowed).toBe(false)
    })
  })
})

describe("waitlistRateLimiter", () => {
  beforeEach(() => {
    waitlistRateLimiter.clear()
  })

  it("allows 5 requests per minute", () => {
    for (let i = 0; i < 5; i++) {
      expect(waitlistRateLimiter.check("test-ip").allowed).toBe(true)
    }
    expect(waitlistRateLimiter.check("test-ip").allowed).toBe(false)
  })

  it("checkAsync allows 5 requests per minute", async () => {
    for (let i = 0; i < 5; i++) {
      expect((await waitlistRateLimiter.checkAsync("test-ip-async")).allowed).toBe(true)
    }
    expect((await waitlistRateLimiter.checkAsync("test-ip-async")).allowed).toBe(false)
  })
})
