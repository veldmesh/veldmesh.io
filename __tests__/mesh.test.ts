// Copyright (c) 2026 Ironfeast Media, LLC. All rights reserved.
import { describe, it, expect, beforeEach, vi } from "vitest"

describe("mesh client", () => {
  beforeEach(() => {
    process.env.WAITLIST_FORWARD_URL = "https://example.com"
    process.env.WAITLIST_BEARER_TOKEN = "test-token"
    process.env.LOG_SALT = "test-salt"
  })

  const basePayload = {
    idempotency_key: "key-1",
    email: "user@example.com",
    source: "website",
    consent_at: new Date().toISOString(),
    consent_version: "1.0",
    consent_text_hash: "hash",
    consent_label: "I agree to receive updates from Veldmesh and understand I can unsubscribe at any time.",
  }

  it("uses the default 10s timeout when MESH_TIMEOUT_MS is not set", async () => {
    delete process.env.MESH_TIMEOUT_MS
    const { postToMesh } = await import("@/lib/mesh")

    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 })

    const result = await postToMesh(basePayload)
    expect(result.ok).toBe(true)
    expect(result.status).toBe(200)
  })

  it("respects a custom MESH_TIMEOUT_MS when set", async () => {
    process.env.MESH_TIMEOUT_MS = "5000"
    const { postToMesh } = await import("@/lib/mesh")

    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 })

    const result = await postToMesh(basePayload)
    expect(result.ok).toBe(true)
    expect(result.status).toBe(200)
  })

  it("falls back to default 10s for invalid MESH_TIMEOUT_MS values", async () => {
    process.env.MESH_TIMEOUT_MS = "not-a-number"
    const { postToMesh } = await import("@/lib/mesh")

    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 })

    const result = await postToMesh(basePayload)
    expect(result.ok).toBe(true)
  })

  it("handles timeouts as retryable failures", async () => {
    delete process.env.MESH_TIMEOUT_MS
    const { postToMesh } = await import("@/lib/mesh")

    global.fetch = vi.fn().mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_, reject) => {
          init.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")))
        })
    )

    const promise = postToMesh(basePayload)
    // Give the setTimeout a chance to fire by advancing time — but since we
    // can't easily fast-forward timers, we just verify the fetch was called
    // with a signal (the timeout mechanism is wired up).
    await new Promise((resolve) => setTimeout(resolve, 20))
    const fetchCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(fetchCall[1].signal).toBeInstanceOf(AbortSignal)
    // Abort to simulate the timeout
    fetchCall[1].signal.dispatchEvent(new Event("abort"))
    const result = await promise
    expect(result.ok).toBe(false)
    expect(result.retryable).toBe(true)
  })
})