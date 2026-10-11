// Copyright (c) 2026 Ironfeast Media, LLC. All rights reserved.
import { describe, it, expect, beforeEach, vi } from "vitest"
import { createRateLimiter, waitlistRateLimiter } from "@/lib/rate-limit"

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
})