// Copyright (c) 2026 Ironfeast Media, LLC. All rights reserved.
//
// Thin runner for the waitlist queue worker. The retry logic itself lives in
// lib/queue-worker.ts (testable, no timers). Run with:
//   npx tsx scripts/waitlist-worker.ts
import { processQueue } from "@/lib/queue-worker"
import { logError, logInfo } from "@/lib/logging"
import { startRateLimitCleanup, stopRateLimitCleanup } from "@/lib/rate-limit"

const WORKER_INTERVAL_MS = 30_000

let isRunning = false
let intervalId: NodeJS.Timeout | null = null
let currentProcessingPromise: Promise<void> | null = null

async function runProcessQueue(): Promise<void> {
  if (isRunning) return
  isRunning = true
  try {
    await processQueue()
  } catch (err) {
    logError("Queue worker error", undefined, undefined, "WORKER_ERROR", { error: err instanceof Error ? err.message : "Unknown error" })
  } finally {
    isRunning = false
  }
}

export function startWorker(): void {
  if (intervalId) return
  // Start the rate limiter cleanup interval now that the worker is running
  startRateLimitCleanup()
  logInfo("Starting waitlist queue worker")
  intervalId = setInterval(() => {
    currentProcessingPromise = runProcessQueue()
  }, WORKER_INTERVAL_MS)
  currentProcessingPromise = runProcessQueue()
}

export async function stopWorker(): Promise<void> {
  if (intervalId) {
    clearInterval(intervalId)
    intervalId = null
    // Wait for any in-flight processing to complete before shutting down.
    if (currentProcessingPromise) {
      await currentProcessingPromise
    }
    // Stop the rate limiter cleanup interval
    stopRateLimitCleanup()
    logInfo("Stopped waitlist queue worker")
  }
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