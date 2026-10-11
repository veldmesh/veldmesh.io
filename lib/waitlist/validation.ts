// Copyright (c) 2026 Ironfeast Media, LLC. All rights reserved.
export const MAX_BODY_BYTES = 8192
export const MAX_EMAIL_LENGTH = 254
export const MAX_PARAM_LENGTH = 512
export const HONEYPOT_FIELD = "company_website"

export interface WaitlistSignup {
  email: string
  consent: boolean
  honeypot: string
  utmSource: string | null
  utmMedium: string | null
  utmCampaign: string | null
  referrer: string | null
}

export type ParseResult =
  | { ok: true; signup: WaitlistSignup }
  | { ok: false; status: 400 | 413; error: string }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isValidEmail(email: string): boolean {
  if (email.length === 0 || email.length > MAX_EMAIL_LENGTH) return false
  return EMAIL_RE.test(email)
}

function cleanParam(value: unknown): string | null {
  if (typeof value !== "string") return null
  const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, "").trim()
  if (cleaned.length === 0) return null
  return cleaned.slice(0, MAX_PARAM_LENGTH)
}

export function parseSignupBody(raw: string): ParseResult {
  let body: Record<string, unknown>
  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return { ok: false, status: 400, error: "Invalid request body." }
    }
    body = parsed as Record<string, unknown>
  } catch {
    return { ok: false, status: 400, error: "Invalid request body." }
  }

  const honeypot = typeof body[HONEYPOT_FIELD] === "string" ? body[HONEYPOT_FIELD] : ""

  if (honeypot.trim().length > 0) {
    return {
      ok: true,
      signup: {
        email: "",
        consent: false,
        honeypot,
        utmSource: null,
        utmMedium: null,
        utmCampaign: null,
        referrer: null,
      },
    }
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""
  if (!isValidEmail(email)) {
    return { ok: false, status: 400, error: "Please enter a valid email address." }
  }

  if (body.consent !== true) {
    return {
      ok: false,
      status: 400,
      error: "Please tick the box so we can email you about your invitation.",
    }
  }

  return {
    ok: true,
    signup: {
      email,
      consent: true,
      honeypot,
      utmSource: cleanParam(body.utm_source),
      utmMedium: cleanParam(body.utm_medium),
      utmCampaign: cleanParam(body.utm_campaign),
      referrer: cleanParam(body.referrer),
    },
  }
}
