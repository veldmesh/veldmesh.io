// Copyright (c) 2026 Ironfeast Media, LLC. All rights reserved.
import { describe, it, expect, beforeAll, vi } from "vitest"

let WaitlistForm: typeof import("@/components/waitlist-form").WaitlistForm
let checkWaitlistConfig: typeof import("@/lib/waitlist-config").checkWaitlistConfig

beforeAll(async () => {
  vi.resetModules()
  process.env.LOG_SALT = "test-salt"
  const formMod = await import("@/components/waitlist-form")
  const configMod = await import("@/lib/waitlist-config")
  WaitlistForm = formMod.WaitlistForm
  checkWaitlistConfig = configMod.checkWaitlistConfig
})

describe("WaitlistForm disabled state", () => {
  it("renders the disabled message when disabled=true", async () => {
    const React = await import("react")
    const { renderToStaticMarkup } = await import("react-dom/server")

    const html = renderToStaticMarkup(React.createElement(WaitlistForm, { pageSource: "home", disabled: true }))

    expect(html).toContain("Waitlist opening soon")
    expect(html).not.toContain("input")
    expect(html).not.toContain("Email address")
  })

  it("renders the full form when disabled is not passed (defaults to false)", async () => {
    const React = await import("react")
    const { renderToStaticMarkup } = await import("react-dom/server")

    const html = renderToStaticMarkup(React.createElement(WaitlistForm, { pageSource: "home" }))

    expect(html).toContain("Email address")
    expect(html).toContain("Join waitlist")
    expect(html).toContain("consent")
  })

  it("checkWaitlistConfig returns enabled: false when WAITLIST_ENABLED is unset (form hidden)", () => {
    delete process.env.WAITLIST_ENABLED
    const result = checkWaitlistConfig()
    expect(result.enabled).toBe(false)
  })

  it("checkWaitlistConfig returns enabled: false when enabled but missing config (form hidden)", () => {
    process.env.WAITLIST_ENABLED = "true"
    delete process.env.WAITLIST_FORWARD_URL
    const result = checkWaitlistConfig()
    expect(result.enabled).toBe(false)
    expect(result.missing.length).toBeGreaterThan(0)
  })

  it("checkWaitlistConfig returns enabled: true when fully configured (form shown)", () => {
    process.env.WAITLIST_ENABLED = "true"
    process.env.WAITLIST_FORWARD_URL = "https://example.com"
    process.env.WAITLIST_BEARER_TOKEN = "token"
    process.env.QUEUE_ENCRYPTION_KEY = "age1test"
    process.env.LOG_SALT = "salt"
    const result = checkWaitlistConfig()
    expect(result.enabled).toBe(true)
    expect(result.missing).toEqual([])
  })
})