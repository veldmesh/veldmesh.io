// Copyright (c) 2026 Ironfeast Media, LLC. All rights reserved.
import { describe, it, expect, beforeEach, afterEach, vi, beforeAll } from "vitest"
import { NextRequest } from "next/server"
import { Decrypter, generateIdentity, identityToRecipient } from "age-encryption"

// Generate a fresh age key pair for each test run — no secrets committed.
let TEST_PUBLIC_KEY: string
let TEST_PRIVATE_KEY: string

beforeAll(async () => {
  const privateKey = await generateIdentity()
  const publicKey = await identityToRecipient(privateKey)
  TEST_PUBLIC_KEY = publicKey
  TEST_PRIVATE_KEY = privateKey

  process.env.QUEUE_ENCRYPTION_KEY = TEST_PUBLIC_KEY
  process.env.LOG_SALT = "test-salt"
  process.env.WAITLIST_QUEUE_DIR = "/tmp/veldsite-test-waitlist-queue-api-test"
  process.env.WAITLIST_FORWARD_URL = "https://example.com"
  process.env.WAITLIST_BEARER_TOKEN = "test-token"
})

const TEST_QUEUE_DIR = "/tmp/veldsite-test-waitlist-queue-api-test"

let POST: typeof import("@/app/api/waitlist/route").POST
let waitlistRateLimiter: typeof import("@/lib/rate-limit").waitlistRateLimiter
let listQueueFiles: typeof import("@/lib/queue-worker").listQueueFiles

beforeAll(async () => {
  const routeMod = await import("@/app/api/waitlist/route")
  const rateLimitMod = await import("@/lib/rate-limit")
  const queueWorkerMod = await import("@/lib/queue-worker")
  POST = routeMod.POST
  waitlistRateLimiter = rateLimitMod.waitlistRateLimiter
  listQueueFiles = queueWorkerMod.listQueueFiles
})

async function decryptForTest(ciphertext: string): Promise<Record<string, unknown>> {
  const decrypter = new Decrypter()
  decrypter.addIdentity(TEST_PRIVATE_KEY)
  const plaintext = await decrypter.decrypt(new Uint8Array(Buffer.from(ciphertext, "base64")), "text")
  return JSON.parse(plaintext)
}

async function readQueuedPayload(): Promise<Record<string, unknown> | null> {
  const { readQueueEnvelope } = await import("@/lib/queue-worker")
  const files = await listQueueFiles()
  if (files.length !== 1) return null
  const envelope = await readQueueEnvelope(files[0])
  if (!envelope) return null
  return decryptForTest(envelope.ciphertext)
}

describe("API /api/waitlist", () => {
  beforeEach(async () => {
    const fs = await import("fs/promises")
    waitlistRateLimiter.clear()
    await fs.rm(TEST_QUEUE_DIR, { recursive: true, force: true })
    await fs.mkdir(TEST_QUEUE_DIR, { recursive: true })
    vi.restoreAllMocks()
    vi.clearAllMocks()
  })

  afterEach(async () => {
    const fs = await import("fs/promises")
    await fs.rm(TEST_QUEUE_DIR, { recursive: true, force: true })
  })

  function createRequest(body: Record<string, unknown>, headers: Record<string, string> = {}): NextRequest {
    return new NextRequest("http://localhost/api/waitlist", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "192.168.1.1",
        ...headers,
      },
      body: JSON.stringify(body),
    })
  }

  describe("validation", () => {
    it("returns 400 for missing email", async () => {
      global.fetch = vi.fn()
      const res = await POST(createRequest({ consent: true }))
      expect(res.status).toBe(400)
      expect((await res.json()).error).toBe("Email is required")
    })

    it("returns 400 for invalid email format", async () => {
      const res = await POST(createRequest({ email: "not-an-email", consent: true }))
      expect(res.status).toBe(400)
      expect((await res.json()).error).toBe("Invalid email format")
    })

    it("returns 400 for disposable email domain", async () => {
      const res = await POST(createRequest({ email: "user@mailinator.com", consent: true }))
      expect(res.status).toBe(400)
      expect((await res.json()).error).toBe("Disposable email domains are not allowed")
    })

    it("returns 400 for missing consent", async () => {
      const res = await POST(createRequest({ email: "user@example.com", consent: false }))
      expect(res.status).toBe(400)
      expect((await res.json()).error).toBe("Consent is required")
    })

    it("normalizes email to lowercase", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Network error"))
      const res = await POST(createRequest({ email: "USER@EXAMPLE.COM", consent: true }))
      expect(res.status).toBe(202)
      const payload = await readQueuedPayload()
      expect(payload!.email).toBe("user@example.com")
    })
  })

  describe("source", () => {
    it("defaults source to \"website\" when the form does not provide one", async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 })
      const res = await POST(createRequest({ email: "user@example.com", consent: true }))
      expect(res.status).toBe(201)
      expect(global.fetch).toHaveBeenCalledWith(
        "https://example.com/api/waitlist",
        expect.objectContaining({
          body: expect.stringContaining('"source":"website"'),
        })
      )
    })

    it("forwards the page source when provided (e.g. \"home\", \"features\", \"docs\", \"waitlist\")", async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 })
      for (const pageSource of ["home", "features", "docs", "waitlist"]) {
        const res = await POST(createRequest({ email: "user@example.com", consent: true, source: pageSource }))
        expect(res.status).toBe(201)
        expect(global.fetch).toHaveBeenLastCalledWith(
          "https://example.com/api/waitlist",
          expect.objectContaining({
            body: expect.stringContaining(`"source":"${pageSource}"`),
          })
        )
      }
    })

    it("sends a visitor-provided source instead of the page default", async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 })
      const res = await POST(createRequest({ email: "user@example.com", consent: true, source: "Hacker News" }))
      expect(res.status).toBe(201)
      expect(global.fetch).toHaveBeenCalledWith(
        "https://example.com/api/waitlist",
        expect.objectContaining({
          body: expect.stringContaining('"source":"Hacker News"'),
        })
      )
    })

    it("treats a whitespace-only source as absent and uses the default", async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 })
      await POST(createRequest({ email: "user@example.com", consent: true, source: "   " }))
      expect(global.fetch).toHaveBeenCalledWith(
        "https://example.com/api/waitlist",
        expect.objectContaining({
          body: expect.stringContaining('"source":"website"'),
        })
      )
    })

    it("truncates source to MAX_SOURCE_LENGTH", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Network error"))
      const res = await POST(createRequest({ email: "user@example.com", consent: true, source: "a".repeat(300) }))
      expect(res.status).toBe(202)
      const payload = await readQueuedPayload()
      expect(payload!.source).toHaveLength(200)
      expect(payload!.source).toBe("a".repeat(200))
    })
  })

  describe("honeypot", () => {
    it("returns generic success and drops the signup when the honeypot is filled", async () => {
      global.fetch = vi.fn()
      const res = await POST(
        createRequest({ email: "bot@example.com", consent: true, company_website: "http://spam.example" })
      )

      // Identical generic success — bots must not be able to tell.
      expect(res.status).toBe(201)
      expect((await res.json()).success).toBe(true)

      // The signup was dropped: no mesh call, nothing queued.
      expect(global.fetch).not.toHaveBeenCalled()
      expect(await listQueueFiles()).toHaveLength(0)
    })

    it("does not treat an empty honeypot as a bot", async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 })
      const res = await POST(createRequest({ email: "user@example.com", consent: true, company_website: "" }))
      expect(res.status).toBe(201)
      expect(global.fetch).toHaveBeenCalled()
    })
  })

  describe("mesh delivery", () => {
    it("returns 201 when the mesh accepts the signup", async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 })
      const res = await POST(createRequest({ email: "user@example.com", consent: true }))
      expect(res.status).toBe(201)
      expect((await res.json()).success).toBe(true)
      expect(await listQueueFiles()).toHaveLength(0)

      const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
      expect(init.headers.Authorization).toBe("Bearer test-token")
      const body = JSON.parse(init.body)
      expect(body.email).toBe("user@example.com")
      expect(body.source).toBe("website")
      expect(body.consent_at).toBeDefined()
      expect(body.consent_version).toBe("1.0")
      expect(body.consent_text_hash).toBeDefined()
      expect(body.idempotency_key).toBeDefined()
    })

    it("returns 202 and queues the entry on retryable mesh failure (network error)", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Network error"))
      const res = await POST(createRequest({ email: "user@example.com", consent: true }))
      expect(res.status).toBe(202)
      expect((await res.json()).queued).toBe(true)
      expect(await listQueueFiles()).toHaveLength(1)
    })

    it("returns 202 and queues the entry on mesh 5xx", async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 503, text: vi.fn() })
      const res = await POST(createRequest({ email: "user@example.com", consent: true }))
      expect(res.status).toBe(202)
      expect(await listQueueFiles()).toHaveLength(1)
    })

    it("returns 202 and queues the entry on mesh 429", async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 429, text: vi.fn() })
      const res = await POST(createRequest({ email: "user@example.com", consent: true }))
      expect(res.status).toBe(202)
      expect(await listQueueFiles()).toHaveLength(1)
    })

    it("returns 202 and queues the entry on mesh 408", async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 408, text: vi.fn() })
      const res = await POST(createRequest({ email: "user@example.com", consent: true }))
      expect(res.status).toBe(202)
      expect(await listQueueFiles()).toHaveLength(1)
    })

    it("returns 400 and does NOT queue on permanent validation rejection (mesh 400)", async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 400, text: vi.fn() })
      const res = await POST(createRequest({ email: "user@example.com", consent: true }))
      expect(res.status).toBe(400)
      expect((await res.json()).error).toBeDefined()
      expect(await listQueueFiles()).toHaveLength(0)
    })

    it("returns 400 and does NOT queue on mesh 422", async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 422, text: vi.fn() })
      const res = await POST(createRequest({ email: "user@example.com", consent: true }))
      expect(res.status).toBe(400)
      expect(await listQueueFiles()).toHaveLength(0)
    })

    it("returns 500 and does NOT queue on other permanent 4xx (e.g. mesh 401)", async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 401, text: vi.fn() })
      const res = await POST(createRequest({ email: "user@example.com", consent: true }))
      expect(res.status).toBe(500)
      expect(await listQueueFiles()).toHaveLength(0)
    })

    it("handles mesh timeout as retryable", async () => {
      global.fetch = vi.fn().mockImplementation(
        () => new Promise((_, reject) => setTimeout(() => reject(new DOMException("Aborted", "AbortError")), 50))
      )
      const res = await POST(createRequest({ email: "user@example.com", consent: true }))
      expect(res.status).toBe(202)
      expect(await listQueueFiles()).toHaveLength(1)
    })

    it("includes UTM params, referrer and ip_hash in the queued entry", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Network error"))
      const res = await POST(
        createRequest({
          email: "user@example.com",
          consent: true,
          utm_source: "newsletter",
          utm_medium: "email",
          utm_campaign: "launch",
          utm_term: "waitlist",
          utm_content: "cta-button",
          referrer: "https://referrer.example.com/page",
        })
      )
      expect(res.status).toBe(202)

      const payload = await readQueuedPayload()
      expect(payload!.utm_source).toBe("newsletter")
      expect(payload!.utm_medium).toBe("email")
      expect(payload!.utm_campaign).toBe("launch")
      expect(payload!.utm_term).toBe("waitlist")
      expect(payload!.utm_content).toBe("cta-button")
      expect(payload!.referrer).toBe("https://referrer.example.com/page")
      expect(payload!.consent_version).toBe("1.0")
      expect(payload!.consent_text_hash).toBeDefined()
      expect(typeof payload!.ip_hash).toBe("string")
    })
  })

  describe("rate limiting", () => {
    it("returns 429 when the per-IP limit is exceeded", async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 })
      for (let i = 0; i < 5; i++) {
        const res = await POST(createRequest({ email: `user${i}@example.com`, consent: true }))
        expect(res.status).toBe(201)
      }

      const res = await POST(createRequest({ email: "user6@example.com", consent: true }))
      expect(res.status).toBe(429)
      expect(res.headers.get("Retry-After")).toBeDefined()
    })

    it("limits by the LAST x-forwarded-for entry, not the first", async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 })
      // A single client spoofs a rotating first entry; the trusted last
      // entry is stable, so the limit applies.
      for (let i = 0; i < 5; i++) {
        const res = await POST(
          createRequest({ email: `user${i}@example.com`, consent: true }, { "x-forwarded-for": `spoof-${i}.example, 198.51.100.7` })
        )
        expect(res.status).toBe(201)
      }
      const blocked = await POST(
        createRequest({ email: "user9@example.com", consent: true }, { "x-forwarded-for": "spoof-9.example, 198.51.100.7" })
      )
      expect(blocked.status).toBe(429)

      // A different real client behind the same proxy is unaffected.
      const other = await POST(
        createRequest({ email: "other@example.com", consent: true }, { "x-forwarded-for": "spoof-9.example, 198.51.100.8" })
      )
      expect(other.status).toBe(201)
    })

    it("limits by x-real-ip when x-forwarded-for is absent", async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 })
      for (let i = 0; i < 5; i++) {
        const res = await POST(createRequest({ email: `user${i}@example.com`, consent: true }, { "x-real-ip": "203.0.113.5" }))
        expect(res.status).toBe(201)
      }
      const res = await POST(createRequest({ email: "user6@example.com", consent: true }, { "x-real-ip": "203.0.113.5" }))
      expect(res.status).toBe(429)
    })

    it("requests without proxy headers get a per-request bucket and never block others", async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 })
      for (let i = 0; i < 10; i++) {
        const res = await POST(createRequest({ email: `user${i}@example.com`, consent: true }, { "x-forwarded-for": "" }))
        expect(res.status).toBe(201)
      }
    })
  })
})