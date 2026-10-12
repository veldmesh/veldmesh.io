// Copyright (c) 2026 Ironfeast Media, LLC. All rights reserved.
import { describe, it, expect, beforeEach, afterEach, vi, beforeAll } from "vitest"
import { generateIdentity, identityToRecipient } from "age-encryption"

// Generate a fresh age key pair for each test run — no secrets committed.
let TEST_PUBLIC_KEY: string

beforeAll(async () => {
  const privateKey = await generateIdentity()
  const publicKey = await identityToRecipient(privateKey)
  TEST_PUBLIC_KEY = publicKey

  process.env.QUEUE_ENCRYPTION_KEY = TEST_PUBLIC_KEY
  process.env.LOG_SALT = "test-salt"
})

let logInfo: typeof import("@/lib/logging").logInfo
let logWarn: typeof import("@/lib/logging").logWarn
let logError: typeof import("@/lib/logging").logError

beforeAll(async () => {
  const mod = await import("@/lib/logging")
  logInfo = mod.logInfo
  logWarn = mod.logWarn
  logError = mod.logError
})

describe("logging", () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {})
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
  })

  afterEach(() => {
    consoleLogSpy.mockRestore()
    consoleWarnSpy.mockRestore()
    consoleErrorSpy.mockRestore()
  })

  it("logInfo outputs JSON with email_hash and consent_at", () => {
    logInfo("Test message", "user@example.com", "2026-01-01T00:00:00.000Z", { foo: "bar" })

    expect(consoleLogSpy).toHaveBeenCalledTimes(1)
    const logged = JSON.parse(consoleLogSpy.mock.calls[0][0] as string)
    expect(logged.level).toBe("info")
    expect(logged.message).toBe("Test message")
    expect(logged.email_hash).toBeDefined()
    expect(logged.email_hash).toHaveLength(64)
    expect(logged.consent_at).toBe("2026-01-01T00:00:00.000Z")
    expect(logged.metadata).toEqual({ foo: "bar" })
    expect(logged.error_code).toBeUndefined()
  })

  it("logWarn includes error_code", () => {
    logWarn("Warning message", "user@example.com", "2026-01-01T00:00:00.000Z", "RATE_LIMIT", { extra: "data" })

    expect(consoleWarnSpy).toHaveBeenCalledTimes(1)
    const logged = JSON.parse(consoleWarnSpy.mock.calls[0][0] as string)
    expect(logged.level).toBe("warn")
    expect(logged.error_code).toBe("RATE_LIMIT")
    expect(logged.metadata).toEqual({ extra: "data" })
  })

  it("logError includes error_code", () => {
    logError("Error message", "user@example.com", "2026-01-01T00:00:00.000Z", "QUEUE_WRITE_FAILED", { error: "disk full" })

    expect(consoleErrorSpy).toHaveBeenCalledTimes(1)
    const logged = JSON.parse(consoleErrorSpy.mock.calls[0][0] as string)
    expect(logged.level).toBe("error")
    expect(logged.error_code).toBe("QUEUE_WRITE_FAILED")
    expect(logged.metadata).toEqual({ error: "disk full" })
  })

  it("logs without email when not provided", () => {
    logInfo("No email message")

    expect(consoleLogSpy).toHaveBeenCalledTimes(1)
    const logged = JSON.parse(consoleLogSpy.mock.calls[0][0] as string)
    expect(logged.email_hash).toBeUndefined()
    expect(logged.consent_at).toBeUndefined()
  })

  it("never logs raw email, referrer, or UTM params", () => {
    logInfo("Test", "user@example.com", "2026-01-01T00:00:00.000Z", {
      referrer: "https://evil.com",
      utm_source: "secret-campaign",
      email: "user@example.com",
    })

    const logged = JSON.parse(consoleLogSpy.mock.calls[0][0] as string)
    const logString = JSON.stringify(logged)

    expect(logged.email_hash).toBeDefined()
    expect(logString).not.toContain("user@example.com")
    expect(logString).not.toContain("evil.com")
    expect(logString).not.toContain("secret-campaign")
    expect(logString).not.toContain("referrer")
    expect(logString).not.toContain("utm_source")
  })
})