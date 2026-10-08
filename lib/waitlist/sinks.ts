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
  return Boolean(env.SMTP_HOST && env.WAITLIST_NOTIFY_TO)
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

export async function sendToEmail(
  env: Record<string, string | undefined>,
  record: WaitlistRecord
): Promise<boolean> {
  const port = env.SMTP_PORT ? Number(env.SMTP_PORT) : 587
  const auth = env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined

  try {
    const transporter = nodemailer.createTransport({
      host: env.SMTP_HOST as string,
      port,
      secure: port === 465,
      auth,
    })

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
      from: env.SMTP_USER ?? "waitlist@veldmesh.io",
      to: env.WAITLIST_NOTIFY_TO as string,
      subject: `New waitlist signup: ${record.email}`,
      text: lines.join("\n"),
    })
    return true
  } catch {
    return false
  }
}
