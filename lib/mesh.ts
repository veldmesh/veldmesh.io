// Copyright (c) 2026 Ironfeast Media, LLC. All rights reserved.
import { logError, logInfo } from "./logging"

function getMeshAddr(): string {
  const addr = process.env.IRONSERVER_MESH_ADDR
  if (!addr) {
    throw new Error("IRONSERVER_MESH_ADDR environment variable is required")
  }
  return addr
}

function getBearerToken(): string {
  const token = process.env.WAITLIST_BEARER_TOKEN
  if (!token) {
    throw new Error("WAITLIST_BEARER_TOKEN environment variable is required")
  }
  return token
}

export interface MeshWaitlistPayload {
  idempotency_key: string
  email: string
  source?: string
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

export async function postToMesh(payload: MeshWaitlistPayload): Promise<{ success: boolean; status?: number; error?: string }> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 10_000)

  try {
    const response = await fetch(`${getMeshAddr()}/api/waitlist`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getBearerToken()}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (response.ok) {
      logInfo("Mesh waitlist submission successful", payload.email, payload.consent_at)
      return { success: true, status: response.status }
    }

    const errorText = await response.text().catch(() => "unknown error")
    logError("Mesh waitlist submission failed", payload.email, payload.consent_at, `MESH_HTTP_${response.status}`, { status: response.status, error: errorText })
    return { success: false, status: response.status, error: `HTTP ${response.status}: ${errorText}` }
  } catch (err) {
    clearTimeout(timeoutId)
    const errorCode = err instanceof DOMException && err.name === "AbortError" ? "MESH_TIMEOUT" : "MESH_ERROR"
    const errorMessage = err instanceof Error ? err.message : "Unknown error"
    logError("Mesh waitlist submission error", payload.email, payload.consent_at, errorCode, { error: errorMessage })
    return { success: false, error: errorMessage }
  }
}