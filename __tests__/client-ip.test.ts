// Copyright (c) 2026 Ironfeast Media, LLC. All rights reserved.
import { describe, it, expect } from "vitest"
import { getClientIp } from "@/lib/client-ip"

function headers(init: Record<string, string>): Headers {
  return new Headers(init)
}

describe("getClientIp", () => {
  it("uses the LAST x-forwarded-for entry (appended by our own proxy)", () => {
    const ip = getClientIp(headers({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" }))
    expect(ip).toBe("5.6.7.8")
  })

  it("ignores client-controlled leading entries", () => {
    const ip = getClientIp(headers({ "x-forwarded-for": "spoofed.example.com, 5.6.7.8" }))
    expect(ip).toBe("5.6.7.8")
  })

  it("uses a single x-forwarded-for entry as-is", () => {
    const ip = getClientIp(headers({ "x-forwarded-for": "5.6.7.8" }))
    expect(ip).toBe("5.6.7.8")
  })

  it("trims whitespace around entries", () => {
    const ip = getClientIp(headers({ "x-forwarded-for": "  1.2.3.4  ,  5.6.7.8  " }))
    expect(ip).toBe("5.6.7.8")
  })

  it("falls back to x-real-ip when x-forwarded-for is absent", () => {
    const ip = getClientIp(headers({ "x-real-ip": "9.9.9.9" }))
    expect(ip).toBe("9.9.9.9")
  })

  it("prefers x-forwarded-for over x-real-ip", () => {
    const ip = getClientIp(headers({ "x-forwarded-for": "1.2.3.4, 5.6.7.8", "x-real-ip": "9.9.9.9" }))
    expect(ip).toBe("5.6.7.8")
  })

  it("gives requests without proxy headers a unique per-request bucket", () => {
    const ip1 = getClientIp(headers({}))
    const ip2 = getClientIp(headers({}))
    const ip3 = getClientIp(new Headers())

    expect(ip1).toMatch(/^no-proxy:/)
    expect(ip2).toMatch(/^no-proxy:/)
    expect(ip3).toMatch(/^no-proxy:/)
    expect(new Set([ip1, ip2, ip3]).size).toBe(3)
  })

  it("treats an empty x-forwarded-for as no proxy header", () => {
    const ip = getClientIp(headers({ "x-forwarded-for": "  " }))
    expect(ip).toMatch(/^no-proxy:/)
  })
})
