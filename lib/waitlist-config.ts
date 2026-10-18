// Copyright (c) 2026 Ironfeast Media, LLC. All rights reserved.
//
// Central waitlist configuration check. The waitlist is enabled only when
// WAITLIST_ENABLED="true" AND all required env vars are present. This check
// runs server-side only; no secrets are exposed to the client.

export interface WaitlistConfigResult {
  enabled: boolean
  missing: string[]
}

/**
 * Check if the waitlist is enabled and fully configured.
 * Required env vars (when enabled):
 * - WAITLIST_FORWARD_URL
 * - WAITLIST_BEARER_TOKEN
 * - QUEUE_ENCRYPTION_KEY
 * - LOG_SALT
 */
export function checkWaitlistConfig(): WaitlistConfigResult {
  const enabled = process.env.WAITLIST_ENABLED === "true"

  if (!enabled) {
    return { enabled: false, missing: [] }
  }

  const required = [
    "WAITLIST_FORWARD_URL",
    "WAITLIST_BEARER_TOKEN",
    "QUEUE_ENCRYPTION_KEY",
    "LOG_SALT",
  ]

  const missing = required.filter((key) => !process.env[key])

  return { enabled: missing.length === 0, missing }
}
