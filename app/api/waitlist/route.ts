// Copyright (c) 2026 Ironfeast Media, LLC. All rights reserved.
import { NextRequest, NextResponse } from "next/server"
import { validateEmail, normalizeEmail } from "@/lib/email"
import { waitlistRateLimiter } from "@/lib/rate-limit"
import { postToMesh } from "@/lib/mesh"
import { writeQueueEntry } from "@/lib/queue"
import { CONSENT_VERSION, CONSENT_TEXT_HASH, MAX_SOURCE_LENGTH } from "@/lib/encryption"
import { logInfo, logWarn, logError } from "@/lib/logging"

export async function POST(request: NextRequest): Promise<NextResponse> {
  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
  const rateLimitResult = waitlistRateLimiter.check(clientIp)

  if (!rateLimitResult.allowed) {
    logWarn("Rate limit exceeded for waitlist signup", undefined, undefined, "RATE_LIMIT_EXCEEDED", { ip: clientIp })
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

  const email = normalizeEmail(body.email as string)
  const source = typeof body.source === "string" ? body.source.slice(0, MAX_SOURCE_LENGTH) : undefined
  const consent = body.consent === true

  const utm_source = typeof body.utm_source === "string" ? body.utm_source : undefined
  const utm_medium = typeof body.utm_medium === "string" ? body.utm_medium : undefined
  const utm_campaign = typeof body.utm_campaign === "string" ? body.utm_campaign : undefined
  const utm_term = typeof body.utm_term === "string" ? body.utm_term : undefined
  const utm_content = typeof body.utm_content === "string" ? body.utm_content : undefined

  const referrer = request.headers.get("referer") ?? undefined

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

  const meshPayload = {
    email,
    source,
    consent_at,
    consent_version: CONSENT_VERSION,
    consent_text_hash: CONSENT_TEXT_HASH,
    utm_source,
    utm_medium,
    utm_campaign,
    utm_term,
    utm_content,
    referrer,
  }

  const meshResult = await postToMesh(meshPayload)

  if (meshResult.success) {
    logInfo("Waitlist signup successful", email, consent_at)
    return NextResponse.json({ success: true }, { status: 201 })
  }

  try {
    await writeQueueEntry(meshPayload)
    logInfo("Waitlist signup queued for retry", email, consent_at)
    return NextResponse.json({ success: true, queued: true }, { status: 202 })
  } catch (err) {
    logError("Failed to queue waitlist signup", email, consent_at, "QUEUE_WRITE_FAILED", { error: err instanceof Error ? err.message : "Unknown error" })
    return NextResponse.json({ error: "Failed to process signup. Please try again later." }, { status: 500 })
  }
}