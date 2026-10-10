// Copyright (c) 2026 Ironfeast Media, LLC. All rights reserved.
import nodemailer from "nodemailer"
import type { WaitlistSignup } from "@/lib/waitlist/validation"

export const WAITLIST_SOURCE = "veldmesh.io"
export const SINK_TIMEOUT_MS = 10_000

export interface WaitlistRecord {
  email: string
  source: string
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  referrer: string | null
  consent_at: string
}

export function buildRecord(signup: WaitlistSignup, consentAt: string): WaitlistRecord {
  return {
    email: signup.email,
    source: WAITLIST_SOURCE,
    utm_source: signup.utmSource,
    utm_medium: signup.utmMedium,
    utm_campaign: signup.utmCampaign,
    referrer: signup.referrer,
    consent_at: consentAt,
  }
}

export function webhookConfigured(env: Record<string, string | undefined>): boolean {
  return typeof env.WAITLIST_WEBHOOK_URL === "string" && env.WAITLIST_WEBHOOK_URL.length > 0
}

export function emailConfigured(env: Record<string, string | undefined>): boolean {
  // SMTP_USER is required: it doubles as the From address, and relays
  // typically reject (or fail SPF/DKIM alignment for) mail from addresses
  // the authenticated account is not authorized to send from.
  return Boolean(env.SMTP_HOST && env.SMTP_USER && env.WAITLIST_NOTIFY_TO)
}

export async function sendToWebhook(
  env: Record<string, string | undefined>,
  record: WaitlistRecord
): Promise<boolean> {
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (env.WAITLIST_WEBHOOK_TOKEN) {
    headers.Authorization = `Bearer ${env.WAITLIST_WEBHOOK_TOKEN}`
  }

  try {
    const res = await fetch(env.WAITLIST_WEBHOOK_URL as string, {
      method: "POST",
      headers,
      body: JSON.stringify(record),
      signal: AbortSignal.timeout(SINK_TIMEOUT_MS),
    })
    return res.ok
  } catch {
    return false
  }
}

type Transporter = ReturnType<typeof nodemailer.createTransport>

// One pooled transporter per SMTP configuration, created lazily on first
// use and reused across requests, so each signup does not pay for a fresh
// TCP/TLS connection plus SMTP handshake. The pool closes idle connections
// on its own; there is nothing to tear down at shutdown.
let cachedTransporter: { key: string; transporter: Transporter } | null = null

function getTransporter(env: Record<string, string | undefined>): Transporter {
  const port = env.SMTP_PORT ? Number(env.SMTP_PORT) : 587
  const options = {
    host: env.SMTP_HOST as string,
    port,
    secure: port === 465,
    pool: true,
    auth: { user: env.SMTP_USER as string, pass: env.SMTP_PASS },
  }
  const key = JSON.stringify(options)
  if (!cachedTransporter || cachedTransporter.key !== key) {
    cachedTransporter = { key, transporter: nodemailer.createTransport(options) }
  }
  return cachedTransporter.transporter
}

export async function sendToEmail(
  env: Record<string, string | undefined>,
  record: WaitlistRecord
): Promise<boolean> {
  try {
    const transporter = getTransporter(env)

    const lines = [
      "New waitlist signup",
      "",
      `Email:      ${record.email}`,
      `Source:     ${record.source}`,
      `Consent at: ${record.consent_at}`,
      `UTM source:   ${record.utm_source ?? "—"}`,
      `UTM medium:   ${record.utm_medium ?? "—"}`,
      `UTM campaign: ${record.utm_campaign ?? "—"}`,
      `Referrer:     ${record.referrer ?? "—"}`,
    ]

    await transporter.sendMail({
      from: env.SMTP_USER as string,
      to: env.WAITLIST_NOTIFY_TO as string,
      subject: `New waitlist signup: ${record.email}`,
      text: lines.join("\n"),
    })
    return true
  } catch {
    return false
  }
}
