// Copyright (c) 2026 Ironfeast Media, LLC. All rights reserved.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { fetchMock, sendMailMock, createTransportMock } = vi.hoisted(() => {
  interface SentMail {
    from?: string
    to?: string
    subject?: string
    text?: string
  }
  interface TransportOptions {
    host?: string
    port?: number
    secure?: boolean
    pool?: boolean
    auth?: { user?: string; pass?: string }
  }
  const sendMailMock = vi.fn((_mail: SentMail) => Promise.resolve({}))
  const createTransportMock = vi.fn((_options: TransportOptions) => ({
    sendMail: sendMailMock,
  }))
  return { fetchMock: vi.fn(), sendMailMock, createTransportMock }
})

vi.mock("nodemailer", () => ({
  default: { createTransport: createTransportMock },
}))

import { HONEYPOT_FIELD } from "@/lib/waitlist/validation"
import { rateLimitBucketCount } from "@/lib/waitlist/rate-limit"
import { POST } from "@/app/api/waitlist/route"

const ENV_KEYS = [
  "WAITLIST_WEBHOOK_URL",
  "WAITLIST_WEBHOOK_TOKEN",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASS",
  "WAITLIST_NOTIFY_TO",
] as const

const WEBHOOK_ENV = {
  WAITLIST_WEBHOOK_URL: "https://collector.internal/api/waitlist",
  WAITLIST_WEBHOOK_TOKEN: "tok-123",
}

const SMTP_ENV = {
  SMTP_HOST: "smtp.example.com",
  SMTP_PORT: "465",
  SMTP_USER: "bot@veldmesh.io",
  SMTP_PASS: "relay-password",
  WAITLIST_NOTIFY_TO: "owner@veldmesh.io",
}

function setEnv(values: Record<string, string> = {}) {
  for (const key of ENV_KEYS) delete process.env[key]
  for (const [key, value] of Object.entries(values)) process.env[key] = value
}

function validPayload(overrides: Record<string, unknown> = {}) {
  return { email: "user@example.com", consent: true, [HONEYPOT_FIELD]: "", ...overrides }
}

let ipCounter = 0
function uniqueIp(): string {
  ipCounter += 1
  return `192.0.2.${ipCounter}`
}

function makeRequest(body: unknown, ip = uniqueIp()): Request {
  return new Request("http://localhost:3000/api/waitlist", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Forwarded-For": ip },
    body: typeof body === "string" ? body : JSON.stringify(body),
  })
}

function bareRequest(): Request {
  return new Request("http://localhost:3000/api/waitlist", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(validPayload()),
  })
}

beforeEach(() => {
  setEnv()
  vi.stubGlobal("fetch", fetchMock)
  fetchMock.mockReset()
  sendMailMock.mockReset()
  createTransportMock.mockClear()
  vi.useFakeTimers()
  vi.setSystemTime(new Date("2026-10-08T12:00:00Z"))
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe("POST /api/waitlist — validation", () => {
  it("rejects a missing email", async () => {
    const res = await POST(makeRequest({ consent: true }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBeTruthy()
  })

  it("rejects malformed email addresses", async () => {
    for (const email of ["not-an-email", "user@nodot", "user @example.com", "@example.com"]) {
      const res = await POST(makeRequest(validPayload({ email })))
      expect(res.status).toBe(400)
    }
  })

  it("rejects emails longer than 254 characters", async () => {
    const email = "a".repeat(250) + "@example.com"
    const res = await POST(makeRequest(validPayload({ email })))
    expect(res.status).toBe(400)
  })

  it("requires the consent checkbox", async () => {
    const missing = validPayload()
    delete (missing as Record<string, unknown>).consent
    for (const consent of [false, undefined]) {
      const payload = validPayload()
      if (consent === false) payload.consent = false
      else delete (payload as Record<string, unknown>).consent
      const res = await POST(makeRequest(payload))
      expect(res.status).toBe(400)
      expect((await res.json()).error).toBeTruthy()
    }
  })

  it("rejects bodies that are not valid JSON", async () => {
    const res = await POST(makeRequest("{not json at all"))
    expect(res.status).toBe(400)
  })

  it("rejects JSON bodies that are not objects", async () => {
    const res = await POST(makeRequest(JSON.stringify(["user@example.com"]), "203.0.113.2"))
    expect(res.status).toBe(400)
    const res2 = await POST(makeRequest(JSON.stringify("user@example.com"), "203.0.113.3"))
    expect(res2.status).toBe(400)
  })

  it("rejects oversized bodies with 413", async () => {
    const res = await POST(
      makeRequest(validPayload({ utm_source: "x".repeat(10_000) }), "203.0.113.4")
    )
    expect(res.status).toBe(413)
  })

  it("normalizes the email address (trim + lowercase)", async () => {
    setEnv(WEBHOOK_ENV)
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }))
    const res = await POST(makeRequest(validPayload({ email: "  User@Example.COM " })))
    expect(res.status).toBe(200)
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(sent.email).toBe("user@example.com")
  })
})

describe("POST /api/waitlist — honeypot", () => {
  it("returns generic success but never forwards honeypot submissions", async () => {
    setEnv(WEBHOOK_ENV)
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }))
    const res = await POST(
      makeRequest(validPayload({ [HONEYPOT_FIELD]: "http://spam.example/" }), "203.0.113.50")
    )
    expect(res.status).toBe(200)
    expect((await res.json()).ok).toBe(true)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(sendMailMock).not.toHaveBeenCalled()
  })

  it("swallows honeypot submissions even with invalid emails", async () => {
    setEnv(WEBHOOK_ENV)
    const res = await POST(
      makeRequest(
        validPayload({ [HONEYPOT_FIELD]: "bots only", email: "not-an-email" }),
        "203.0.113.51"
      )
    )
    expect(res.status).toBe(200)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe("POST /api/waitlist — rate limiting", () => {
  it("allows a burst of 5 per IP, blocks the 6th, and refills over time", async () => {
    setEnv(WEBHOOK_ENV)
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }))
    const ip = "198.51.100.7"

    for (let i = 0; i < 5; i++) {
      const res = await POST(makeRequest(validPayload(), ip))
      expect(res.status).toBe(200)
    }

    const blocked = await POST(makeRequest(validPayload(), ip))
    expect(blocked.status).toBe(429)
    expect((await blocked.json()).error).toBeTruthy()

    const otherIp = await POST(makeRequest(validPayload(), "198.51.100.8"))
    expect(otherIp.status).toBe(200)

    vi.setSystemTime(new Date("2026-10-08T12:01:00Z"))
    const afterRefill = await POST(makeRequest(validPayload(), ip))
    expect(afterRefill.status).toBe(200)

    const blockedAgain = await POST(makeRequest(validPayload(), ip))
    expect(blockedAgain.status).toBe(429)
  })

  it("sweeps stale buckets so the tracked-IP map stays bounded", async () => {
    setEnv(WEBHOOK_ENV)
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }))
    const ip = "198.51.100.30"

    for (let i = 0; i < 5; i++) {
      const res = await POST(makeRequest(validPayload(), ip))
      expect(res.status).toBe(200)
    }
    const blocked = await POST(makeRequest(validPayload(), ip))
    expect(blocked.status).toBe(429)
    const trackedBefore = rateLimitBucketCount()
    expect(trackedBefore).toBeGreaterThan(0)

    // Far past the eviction window: every bucket idle long enough to have
    // fully refilled is swept, so the map shrinks instead of growing.
    vi.setSystemTime(new Date("2027-01-01T00:00:00Z"))
    const res = await POST(makeRequest(validPayload(), "198.51.100.31"))
    expect(res.status).toBe(200)
    expect(rateLimitBucketCount()).toBe(1)

    // Eviction is invisible to the swept client: it starts with a full bucket.
    const revisited = await POST(makeRequest(validPayload(), ip))
    expect(revisited.status).toBe(200)
    expect(rateLimitBucketCount()).toBe(2)
  })

  it("does not share one bucket when no proxy header is present", async () => {
    setEnv(WEBHOOK_ENV)
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }))

    // Without x-forwarded-for/x-real-ip, requests must not all land in one
    // shared bucket — otherwise one direct client could block every other.
    for (let i = 0; i < 6; i++) {
      const res = await POST(bareRequest())
      expect(res.status).toBe(200)
    }
  })

  it("still rate limits requests that share the same x-real-ip", async () => {
    setEnv(WEBHOOK_ENV)
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }))
    const request = () =>
      new Request("http://localhost:3000/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Real-Ip": "198.51.100.9" },
        body: JSON.stringify(validPayload()),
      })

    for (let i = 0; i < 5; i++) {
      const res = await POST(request())
      expect(res.status).toBe(200)
    }
    const blocked = await POST(request())
    expect(blocked.status).toBe(429)
  })
})

describe("POST /api/waitlist — sink selection", () => {
  it("forwards to the webhook only, with bearer auth and the full record", async () => {
    setEnv(WEBHOOK_ENV)
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }))
    const res = await POST(
      makeRequest(
        validPayload({
          utm_source: "reddit",
          utm_medium: "social",
          utm_campaign: "launch",
          referrer: "https://news.ycombinator.com/",
        }),
        "203.0.113.60"
      )
    )
    expect(res.status).toBe(200)
    expect(sendMailMock).not.toHaveBeenCalled()
    expect(fetchMock).toHaveBeenCalledTimes(1)

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe("https://collector.internal/api/waitlist")
    expect(init.method).toBe("POST")
    expect(init.headers["Content-Type"]).toBe("application/json")
    expect(init.headers.Authorization).toBe("Bearer tok-123")
    expect(JSON.parse(init.body)).toEqual({
      email: "user@example.com",
      source: "veldmesh.io",
      utm_source: "reddit",
      utm_medium: "social",
      utm_campaign: "launch",
      referrer: "https://news.ycombinator.com/",
      consent_at: new Date("2026-10-08T12:00:00Z").toISOString(),
    })
  })

  it("sends null for missing utm fields and referrer", async () => {
    setEnv(WEBHOOK_ENV)
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }))
    const res = await POST(makeRequest(validPayload(), "203.0.113.61"))
    expect(res.status).toBe(200)
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(sent.utm_source).toBeNull()
    expect(sent.utm_medium).toBeNull()
    expect(sent.utm_campaign).toBeNull()
    expect(sent.referrer).toBeNull()
  })

  it("does not send an Authorization header when no token is configured", async () => {
    setEnv({ WAITLIST_WEBHOOK_URL: "https://collector.internal/api/waitlist" })
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }))
    const res = await POST(makeRequest(validPayload(), "203.0.113.62"))
    expect(res.status).toBe(200)
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBeUndefined()
  })

  it("sends email only, using SMTP settings from the environment", async () => {
    setEnv(SMTP_ENV)
    sendMailMock.mockResolvedValue({ accepted: ["owner@veldmesh.io"] })
    const res = await POST(makeRequest(validPayload(), "203.0.113.63"))
    expect(res.status).toBe(200)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(sendMailMock).toHaveBeenCalledTimes(1)

    expect(createTransportMock).toHaveBeenCalledTimes(1)
    expect(createTransportMock.mock.calls[0][0]).toEqual({
      host: "smtp.example.com",
      port: 465,
      secure: true,
      pool: true,
      auth: { user: "bot@veldmesh.io", pass: "relay-password" },
    })

    const mail = sendMailMock.mock.calls[0][0]
    expect(mail.from).toBe("bot@veldmesh.io")
    expect(mail.to).toBe("owner@veldmesh.io")
    expect(mail.subject).toContain("user@example.com")
    expect(mail.text).toContain("user@example.com")
    expect(mail.text).toContain(new Date("2026-10-08T12:00:00Z").toISOString())
  })

  it("creates one pooled transporter per SMTP configuration and reuses it", async () => {
    setEnv({ ...SMTP_ENV, SMTP_HOST: "smtp-pool.example.com" })
    sendMailMock.mockResolvedValue({})

    const first = await POST(makeRequest(validPayload(), "203.0.113.72"))
    expect(first.status).toBe(200)
    const second = await POST(makeRequest(validPayload(), "203.0.113.73"))
    expect(second.status).toBe(200)

    expect(sendMailMock).toHaveBeenCalledTimes(2)
    // Two signups, one transporter — not a fresh connection per request.
    expect(createTransportMock).toHaveBeenCalledTimes(1)
  })

  it("succeeds when the webhook fails but email succeeds", async () => {
    setEnv({ ...WEBHOOK_ENV, ...SMTP_ENV })
    fetchMock.mockResolvedValue(new Response("boom", { status: 500 }))
    sendMailMock.mockResolvedValue({})
    const res = await POST(makeRequest(validPayload(), "203.0.113.64"))
    expect(res.status).toBe(200)
    expect((await res.json()).ok).toBe(true)
  })

  it("treats a network error from the webhook as a sink failure", async () => {
    setEnv({ ...WEBHOOK_ENV, ...SMTP_ENV })
    fetchMock.mockRejectedValue(new Error("ECONNREFUSED"))
    sendMailMock.mockResolvedValue({})
    const res = await POST(makeRequest(validPayload(), "203.0.113.65"))
    expect(res.status).toBe(200)
  })

  it("returns 502 when every configured sink fails", async () => {
    setEnv({ ...WEBHOOK_ENV, ...SMTP_ENV })
    fetchMock.mockResolvedValue(new Response("boom", { status: 500 }))
    sendMailMock.mockRejectedValue(new Error("ECONNREFUSED"))
    const res = await POST(makeRequest(validPayload(), "203.0.113.66"))
    expect(res.status).toBe(502)
    expect((await res.json()).error).toBeTruthy()
  })

  it("returns 503 when no sink is configured", async () => {
    setEnv()
    const res = await POST(makeRequest(validPayload(), "203.0.113.67"))
    expect(res.status).toBe(503)
    expect((await res.json()).error).toBeTruthy()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(sendMailMock).not.toHaveBeenCalled()
  })

  it("treats the email sink as unconfigured when SMTP_USER is missing", async () => {
    // SMTP_USER doubles as the From address; without it the relay would
    // likely reject or misalign the message (SPF/DKIM), so the sink must
    // stay off rather than send from an unverified address.
    const withoutUser: Record<string, string> = { ...SMTP_ENV }
    delete withoutUser.SMTP_USER
    setEnv(withoutUser)

    const res = await POST(makeRequest(validPayload(), "203.0.113.74"))
    expect(res.status).toBe(503)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(sendMailMock).not.toHaveBeenCalled()
  })
})

describe("POST /api/waitlist — success behavior", () => {
  it("returns a generic success message for a valid signup", async () => {
    setEnv(WEBHOOK_ENV)
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }))
    const res = await POST(makeRequest(validPayload(), "203.0.113.70"))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(typeof body.message).toBe("string")
    expect(body.message.length).toBeGreaterThan(0)
  })

  it("always records the server-side consent timestamp", async () => {
    setEnv(WEBHOOK_ENV)
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }))
    vi.setSystemTime(new Date("2026-10-09T09:30:00Z"))
    await POST(makeRequest(validPayload(), "203.0.113.71"))
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(sent.consent_at).toBe(new Date("2026-10-09T09:30:00Z").toISOString())
  })
})
