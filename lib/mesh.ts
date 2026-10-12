// Copyright (c) 2026 Ironfeast Media, LLC. All rights reserved.
//
// Client for the operator's server, reached over the Veld mesh. All
// addresses and credentials come from environment variables; nothing about
// the server is hardcoded here.
import { logError, logInfo } from "./logging"

const MESH_TIMEOUT_MS = 10_000

export interface MeshWaitlistPayload {
  idempotency_key: string
  email: string
  source: string
  consent_at: string
  consent_version: string
  consent_text_hash: string
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  utm_term?: string
  utm_content?: string
  referrer?: string
}

export interface MeshResult {
  ok: boolean
  status?: number
  /** true for network errors, timeouts, 408, 429 and 5xx — the only failures worth retrying */
  retryable: boolean
}

function getMeshAddr(): string {
  const addr = process.env.IRONSERVER_MESH_ADDR
  if (!addr) {
    throw new Error("IRONSERVER_MESH_ADDR environment variable is required")
  }
  let parsed: URL
  try {
    parsed = new URL(addr)
  } catch {
    throw new Error("IRONSERVER_MESH_ADDR must be a valid URL (e.g. https://host)")
  }
  if (parsed.protocol !== "https:" && process.env.NODE_ENV === "production") {
    throw new Error("IRONSERVER_MESH_ADDR must use https in production")
  }
  return addr.replace(/\/+$/, "")
}

function getBearerToken(): string {
  const token = process.env.WAITLIST_BEARER_TOKEN
  if (!token) {
    throw new Error("WAITLIST_BEARER_TOKEN environment variable is required")
  }
  return token
}

/** Only timeouts, network errors, 408, 429 and 5xx are worth retrying. */
export function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500
}

/** Mesh 400/422 mean the payload itself is invalid — map those to a user-facing 400. */
export function isValidationStatus(status: number): boolean {
  return status === 400 || status === 422
}

async function meshPost(path: string, body: unknown, email: string | undefined, consent_at: string | undefined): Promise<MeshResult> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), MESH_TIMEOUT_MS)

  try {
    const response = await fetch(`${getMeshAddr()}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getBearerToken()}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (response.ok) {
      return { ok: true, status: response.status, retryable: false }
    }

    // Never log the response body: it could echo back submitted values.
    logError("Mesh request failed", email, consent_at, `MESH_HTTP_${response.status}`, { status: response.status, path, retryable: isRetryableStatus(response.status) })
    return { ok: false, status: response.status, retryable: isRetryableStatus(response.status) }
  } catch (err) {
    clearTimeout(timeoutId)
    const timeout = err instanceof DOMException && err.name === "AbortError"
    logError("Mesh request error", email, consent_at, timeout ? "MESH_TIMEOUT" : "MESH_ERROR", { path })
    return { ok: false, retryable: true }
  }
}

/** Submit a fresh waitlist signup to the operator's server. */
export async function postToMesh(payload: MeshWaitlistPayload): Promise<MeshResult> {
  const result = await meshPost("/api/waitlist", payload, payload.email, payload.consent_at)
  if (result.ok) {
    logInfo("Waitlist submission delivered", payload.email, payload.consent_at, { path: "/api/waitlist" })
  }
  return result
}

/**
 * Deliver a previously queued signup. The web server cannot decrypt the
 * entry (it holds only the encryption public key), so it forwards the
 * ciphertext unchanged; the operator's server, which holds the private key,
 * decrypts it there and deduplicates on idempotency_key.
 */
export async function postQueuedToMesh(idempotency_key: string, ciphertext: string): Promise<MeshResult> {
  const result = await meshPost("/api/waitlist/queued", { idempotency_key, ciphertext }, undefined, undefined)
  if (result.ok) {
    logInfo("Queued waitlist submission delivered", undefined, undefined, { idempotency_key, path: "/api/waitlist/queued" })
  }
  return result
}
