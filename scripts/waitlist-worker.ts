// Copyright (c) 2026 Ironfeast Media, LLC. All rights reserved.
//
// Thin runner for the waitlist queue worker. The retry logic itself lives in
// lib/queue-worker.ts (testable, no timers). Run with:
//   npx tsx scripts/waitlist-worker.ts
import { checkWaitlistConfig } from "@/lib/waitlist-config"
import { processQueue } from "@/lib/queue-worker"
import { logError, logInfo } from "@/lib/logging"
import { startRateLimitCleanup, stopRateLimitCleanup } from "@/lib/rate-limit"

const WORKER_INTERVAL_MS = 30_000

let isRunning = false
let currentProcessingPromise: Promise<void> | null = null
let nextTimeout: NodeJS.Timeout | null = null

async function runProcessQueue(): Promise<void> {
  if (isRunning) return
  isRunning = true
  try {
    await processQueue()
  } catch (err) {
    logError("Queue worker error", undefined, undefined, "WORKER_ERROR", { error: err instanceof Error ? err.message : "Unknown error" })
  } finally {
    isRunning = false
    // Schedule the next run 30s after this one finishes (no drift, no overlap)
    if (nextTimeout) {
      clearTimeout(nextTimeout)
    }
    nextTimeout = setTimeout(() => {
      currentProcessingPromise = runProcessQueue()
    }, WORKER_INTERVAL_MS)
  }
}

export function startWorker(): void {
  // Check if waitlist is enabled and configured
  const { enabled, missing } = checkWaitlistConfig()
  if (!enabled) {
    if (missing.length > 0) {
      logInfo("Waitlist worker not starting: not fully configured", undefined, undefined, { missing })
    } else {
      logInfo("Waitlist worker not starting: disabled via WAITLIST_ENABLED")
    }
    return
  }

  // Start the rate limiter cleanup interval now that the worker is running
  startRateLimitCleanup()
  logInfo("Starting waitlist queue worker")
  currentProcessingPromise = runProcessQueue()
}

export async function stopWorker(): Promise<void> {
  if (nextTimeout) {
    clearTimeout(nextTimeout)
    nextTimeout = null
  }
  // Wait for any in-flight processing to complete before shutting down.
  if (currentProcessingPromise) {
    await currentProcessingPromise
  }
  // Stop the rate limiter cleanup interval
  stopRateLimitCleanup()
  logInfo("Stopped waitlist queue worker")
}

/** Reset worker state for testing (not for production use). */
export function resetWorkerState(): void {
  if (nextTimeout) {
    clearTimeout(nextTimeout)
    nextTimeout = null
  }
  currentProcessingPromise = null
  isRunning = false
}

if (require.main === module) {
  startWorker()
  process.on("SIGINT", async () => {
    await stopWorker()
    process.exit(0)
  })
  process.on("SIGTERM", async () => {
    await stopWorker()
    process.exit(0)
  })
}