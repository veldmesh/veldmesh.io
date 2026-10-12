// Copyright (c) 2026 Ironfeast Media, LLC. All rights reserved.
import { randomUUID } from "crypto"
import { NextRequest, NextResponse } from "next/server"
import { validateEmail, normalizeEmail } from "@/lib/email"
import { waitlistRateLimiter } from "@/lib/rate-limit"
import { getClientIp } from "@/lib/client-ip"
import { postToMesh, isValidationStatus } from "@/lib/mesh"
import { writeQueueEntry } from "@/lib/queue"
import { CONSENT_VERSION, CONSENT_LABEL, DEFAULT_SOURCE, MAX_SOURCE_LENGTH, HONEYPOT_FIELD } from "@/lib/constants"
import { CONSENT_TEXT_HASH, hashEmail } from "@/lib/encryption"
import { logInfo, logWarn, logError } from "@/lib/logging"

export const runtime = "nodejs"

const PERMANENT_VALIDATION_MESSAGE = "Your signup could not be accepted. Please check your email address and try again."
const PERMANENT_SERVER_MESSAGE = "Something went wrong on our side. Please try again later."

export async function POST(request: NextRequest): Promise<NextResponse> {
  const clientIp = getClientIp(request.headers)
  const rateLimitResult = waitlistRateLimiter.check(clientIp)

  if (!rateLimitResult.allowed) {
    logWarn("Rate limit exceeded for waitlist signup", undefined, undefined, "RATE_LIMIT_EXCEEDED", { ip_hash: hashEmail(clientIp) })
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000).toString() } }
    )
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  // Honeypot: bots fill the hidden field. Reply with the exact generic
  // success response and drop the signup — never forwarded anywhere.
  const honeypot = typeof body[HONEYPOT_FIELD] === "string" ? (body[HONEYPOT_FIELD] as string) : ""
  if (honeypot.trim().length > 0) {
    logWarn("Waitlist signup dropped (honeypot triggered)", undefined, undefined, "HONEYPOT_TRIGGERED", {
      ip_hash: hashEmail(clientIp),
    })
    return NextResponse.json({ success: true }, { status: 201 })
  }

  const email = normalizeEmail(typeof body.email === "string" ? body.email : "")
  const consent = body.consent === true

  const rawSource = typeof body.source === "string" ? body.source.trim() : ""
  const source = rawSource.length > 0 ? rawSource.slice(0, MAX_SOURCE_LENGTH) : DEFAULT_SOURCE

  const utm_source = typeof body.utm_source === "string" ? body.utm_source : undefined
  const utm_medium = typeof body.utm_medium === "string" ? body.utm_medium : undefined
  const utm_campaign = typeof body.utm_campaign === "string" ? body.utm_campaign : undefined
  const utm_term = typeof body.utm_term === "string" ? body.utm_term : undefined
  const utm_content = typeof body.utm_content === "string" ? body.utm_content : undefined
  const referrer = typeof body.referrer === "string" ? body.referrer : undefined

  const emailValidation = validateEmail(email)
  if (!emailValidation.valid) {
    logWarn("Waitlist signup validation failed", email, undefined, "VALIDATION_ERROR", { error: emailValidation.error })
    return NextResponse.json({ error: emailValidation.error }, { status: 400 })
  }

  if (!consent) {
    logWarn("Waitlist signup missing consent", email, undefined, "MISSING_CONSENT")
    return NextResponse.json({ error: "Consent is required" }, { status: 400 })
  }

  const consent_at = new Date().toISOString()

  const payload = {
    idempotency_key: randomUUID(),
    email,
    source,
    consent_at,
    consent_version: CONSENT_VERSION,
    consent_text_hash: CONSENT_TEXT_HASH,
    consent_label: CONSENT_LABEL,
    utm_source,
    utm_medium,
    utm_campaign,
    utm_term,
    utm_content,
    referrer,
  }

  const meshResult = await postToMesh(payload)

  if (meshResult.ok) {
    logInfo("Waitlist signup successful", email, consent_at)
    return NextResponse.json({ success: true }, { status: 201 })
  }

  if (!meshResult.retryable) {
    // Permanent rejection: a 4xx (other than 408/429) from the operator's
    // server means the signup will never be accepted — do not queue it.
    const status = meshResult.status !== undefined && isValidationStatus(meshResult.status) ? 400 : 500
    logError("Waitlist signup permanently rejected by server", email, consent_at, `MESH_PERMANENT_${meshResult.status ?? 0}`, {})
    return NextResponse.json(
      { error: status === 400 ? PERMANENT_VALIDATION_MESSAGE : PERMANENT_SERVER_MESSAGE },
      { status }
    )
  }

  // Retryable failure (network error, timeout, 408, 429, 5xx): keep the
  // signup in the encrypted queue and let the worker redeliver it.
  try {
    await writeQueueEntry({ ...payload, ip: clientIp })
    logInfo("Waitlist signup queued for retry", email, consent_at)
    return NextResponse.json({ success: true, queued: true }, { status: 202 })
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error"
    if (errorMessage.startsWith("QUEUE_FULL")) {
      logError("Queue full, rejecting waitlist signup", email, consent_at, "QUEUE_FULL", {})
      return NextResponse.json({ error: "Service temporarily unavailable. Please try again later." }, { status: 503 })
    }
    logError("Failed to queue waitlist signup", email, consent_at, "QUEUE_WRITE_FAILED", {})
    return NextResponse.json({ error: "Failed to process signup. Please try again later." }, { status: 500 })
  }
}
