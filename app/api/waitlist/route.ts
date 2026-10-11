// Copyright (c) 2026 Ironfeast Media, LLC. All rights reserved.
import { randomUUID } from "node:crypto"
import { MAX_BODY_BYTES, parseSignupBody } from "@/lib/waitlist/validation"
import { checkRateLimit } from "@/lib/waitlist/rate-limit"
import {
  buildRecord,
  emailConfigured,
  sendToEmail,
  sendToWebhook,
  webhookConfigured,
} from "@/lib/waitlist/sinks"

export const runtime = "nodejs"

const SUCCESS_MESSAGE = "You're on the list. We'll email you when your invitation is ready."
const NOT_OPEN_MESSAGE =
  "The waitlist isn't open for signups right now. Please check back a little later."
const SINKS_FAILED_MESSAGE =
  "Something went wrong saving your signup. Please try again in a moment."
const RATE_LIMIT_MESSAGE = "Too many attempts. Please wait a minute and try again."
const BODY_TOO_LARGE_MESSAGE = "Request body too large."
const BODY_UNREADABLE_MESSAGE = "Invalid request body."

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")
  if (forwarded) {
    const first = forwarded.split(",")[0].trim()
    if (first) return first
  }
  const realIp = request.headers.get("x-real-ip")?.trim()
  if (realIp) return realIp
  // No proxy header: production traffic always arrives through a reverse
  // proxy (nginx/Vercel) that sets x-forwarded-for, so this is direct
  // access. Give each such request a private bucket key instead of a
  // shared "unknown" bucket, so one direct client cannot exhaust the
  // limit for every other direct client. These requests are not
  // per-client rate limited — the origin should never be exposed
  // directly (see README).
  return `unknown:${randomUUID()}`
}

export async function POST(request: Request): Promise<Response> {
  const ip = clientIp(request)
  if (!checkRateLimit(ip, Date.now())) {
    return json({ error: RATE_LIMIT_MESSAGE }, 429)
  }

  const declaredSize = Number(request.headers.get("content-length") ?? "0")
  if (Number.isFinite(declaredSize) && declaredSize > MAX_BODY_BYTES) {
    return json({ error: BODY_TOO_LARGE_MESSAGE }, 413)
  }

  let raw: string
  try {
    raw = await request.text()
  } catch {
    return json({ error: BODY_UNREADABLE_MESSAGE }, 400)
  }
  if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) {
    return json({ error: BODY_TOO_LARGE_MESSAGE }, 413)
  }

  const parsed = parseSignupBody(raw)
  if (!parsed.ok) {
    return json({ error: parsed.error }, parsed.status)
  }

  if (parsed.signup.honeypot.trim().length > 0) {
    return json({ ok: true, message: SUCCESS_MESSAGE }, 200)
  }

  const record = buildRecord(parsed.signup, new Date().toISOString())

  const sinks: Array<Promise<boolean>> = []
  if (webhookConfigured(process.env)) sinks.push(sendToWebhook(process.env, record))
  if (emailConfigured(process.env)) sinks.push(sendToEmail(process.env, record))

  if (sinks.length === 0) {
    return json({ error: NOT_OPEN_MESSAGE }, 503)
  }

  const results = await Promise.all(sinks)
  if (!results.some((succeeded) => succeeded)) {
    return json({ error: SINKS_FAILED_MESSAGE }, 502)
  }

  return json({ ok: true, message: SUCCESS_MESSAGE }, 200)
}
