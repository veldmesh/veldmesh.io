// Copyright (c) 2026 Ironfeast Media, LLC. All rights reserved.
// Next.js instrumentation hook — runs once when the server starts.
// Starts the rate limiter cleanup interval for the waitlist API route.

import { startRateLimitCleanup } from "@/lib/rate-limit"

export async function register(): Promise<void> {
  if (process.env.NODE_ENV !== "test") {
    startRateLimitCleanup()
  }
}