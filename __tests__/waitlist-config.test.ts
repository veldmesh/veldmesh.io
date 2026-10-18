// Copyright (c) 2026 Ironfeast Media, LLC. All rights reserved.
import { describe, it, expect, beforeEach, vi } from "vitest"

let checkWaitlistConfig: typeof import("@/lib/waitlist-config").checkWaitlistConfig

beforeEach(async () => {
  vi.resetModules()
  const mod = await import("@/lib/waitlist-config")
  checkWaitlistConfig = mod.checkWaitlistConfig
})

describe("checkWaitlistConfig", () => {
  const fullConfig = {
    WAITLIST_ENABLED: "true",
    WAITLIST_FORWARD_URL: "https://example.com",
    WAITLIST_BEARER_TOKEN: "token",
    QUEUE_ENCRYPTION_KEY: "age1test",
    LOG_SALT: "salt",
  }

  it("returns enabled: false when WAITLIST_ENABLED is not set", () => {
    delete process.env.WAITLIST_ENABLED
    const result = checkWaitlistConfig()
    expect(result.enabled).toBe(false)
    expect(result.missing).toEqual([])
  })

  it("returns enabled: false when WAITLIST_ENABLED is not 'true'", () => {
    process.env.WAITLIST_ENABLED = "false"
    const result = checkWaitlistConfig()
    expect(result.enabled).toBe(false)
    expect(result.missing).toEqual([])
    delete process.env.WAITLIST_ENABLED
  })

  it("returns enabled: false with missing vars when enabled but config incomplete", () => {
    process.env.WAITLIST_ENABLED = "true"
    delete process.env.WAITLIST_FORWARD_URL
    delete process.env.WAITLIST_BEARER_TOKEN
    delete process.env.QUEUE_ENCRYPTION_KEY
    delete process.env.LOG_SALT

    const result = checkWaitlistConfig()
    expect(result.enabled).toBe(false)
    expect(result.missing).toContain("WAITLIST_FORWARD_URL")
    expect(result.missing).toContain("WAITLIST_BEARER_TOKEN")
    expect(result.missing).toContain("QUEUE_ENCRYPTION_KEY")
    expect(result.missing).toContain("LOG_SALT")
    expect(result.missing).toHaveLength(4)
  })

  it("returns enabled: false with partial missing when some config present", () => {
    process.env.WAITLIST_ENABLED = "true"
    process.env.WAITLIST_FORWARD_URL = "https://example.com"
    delete process.env.WAITLIST_BEARER_TOKEN
    delete process.env.QUEUE_ENCRYPTION_KEY
    delete process.env.LOG_SALT

    const result = checkWaitlistConfig()
    expect(result.enabled).toBe(false)
    expect(result.missing).toContain("WAITLIST_BEARER_TOKEN")
    expect(result.missing).toContain("QUEUE_ENCRYPTION_KEY")
    expect(result.missing).toContain("LOG_SALT")
    expect(result.missing).not.toContain("WAITLIST_FORWARD_URL")
  })

  it("returns enabled: true when all required config is present", () => {
    Object.entries(fullConfig).forEach(([key, value]) => {
      process.env[key] = value
    })

    const result = checkWaitlistConfig()
    expect(result.enabled).toBe(true)
    expect(result.missing).toEqual([])
  })

  it("does not expose secret values in the result", () => {
    Object.entries(fullConfig).forEach(([key, value]) => {
      process.env[key] = value
    })

    const result = checkWaitlistConfig()
    const resultStr = JSON.stringify(result)
    expect(resultStr).not.toContain("token")
    expect(resultStr).not.toContain("salt")
  })
})
describe("pages export dynamic force-dynamic", () => {
  const pages = [
    "@/app/page",
    "@/app/features/page",
    "@/app/docs/page",
    "@/app/waitlist/page",
  ]

  it("each page exports dynamic = 'force-dynamic'", async () => {
    for (const page of pages) {
      const mod = await import(page)
      expect(mod.dynamic).toBe("force-dynamic")
    }
  })
})
