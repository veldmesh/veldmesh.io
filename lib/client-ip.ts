// Copyright (c) 2026 Ironfeast Media, LLC. All rights reserved.
import { randomUUID } from "crypto"

/**
 * Resolve the client IP for rate limiting.
 *
 * The app MUST sit behind exactly one trusted reverse proxy that appends the
 * connecting client's IP to `x-forwarded-for` (or sets `x-real-ip`). Under
 * that assumption the LAST `x-forwarded-for` entry is the one appended by our
 * own proxy and is trustworthy; earlier entries are client-controlled and
 * must never be used for limiting, or a client could spoof an innocent IP
 * into the bucket (or rotate fake IPs to evade the limit).
 *
 * Requests that arrive with neither header did not come through the trusted
 * proxy (e.g. direct origin access, which should never be exposed). They get
 * a private per-request bucket key so one such client cannot exhaust the
 * limit for every other client — this traffic is not per-client rate limited.
 */
export function getClientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")
  if (forwarded) {
    const entries = forwarded
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0)
    const last = entries[entries.length - 1]
    if (last) return last
  }

  const realIp = headers.get("x-real-ip")?.trim()
  if (realIp) return realIp

  return `no-proxy:${randomUUID()}`
}
