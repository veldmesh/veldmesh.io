// Copyright (c) 2026 Ironfeast Media, LLC. All rights reserved.
import { postToMesh } from "@/lib/mesh"
import { listQueueFiles, readQueueEntry, deleteQueueFile, updateQueueEntry, calculateNextRetry, isPermanentFailure } from "@/lib/queue-worker"
import { logInfo, logWarn, logError } from "@/lib/logging"

const WORKER_INTERVAL = 30_000

let isRunning = false
let intervalId: NodeJS.Timeout | null = null
let currentProcessingPromise: Promise<void> | null = null

async function processQueue(): Promise<void> {
  if (isRunning) return
  isRunning = true

  try {
    const files = await listQueueFiles()
    const now = new Date()

    for (const filepath of files) {
      const entry = await readQueueEntry(filepath)
      if (!entry) {
        logWarn("Failed to read queue entry, deleting corrupted file", undefined, undefined, "QUEUE_READ_FAILED", { filepath })
        await deleteQueueFile(filepath)
        continue
      }

      const nextRetryAt = new Date(entry.next_retry_at)
      if (now < nextRetryAt) {
        continue
      }

      if (isPermanentFailure(entry)) {
        logError("Permanent failure - queue entry expired after 24h", entry.email, entry.consent_at, "QUEUE_EXPIRED", {
          queued_at: entry.queued_at,
          retry_count: entry.retry_count,
        })
        await deleteQueueFile(filepath)
        continue
      }

      const meshPayload = {
        idempotency_key: entry.idempotency_key,
        email: entry.email,
        source: entry.source,
        consent_at: entry.consent_at,
        consent_version: entry.consent_version,
        consent_text_hash: entry.consent_text_hash,
        utm_source: entry.utm_source,
        utm_medium: entry.utm_medium,
        utm_campaign: entry.utm_campaign,
        utm_term: entry.utm_term,
        utm_content: entry.utm_content,
        referrer: entry.referrer,
      }

      const result = await postToMesh(meshPayload)

      if (result.success) {
        logInfo("Queued waitlist signup delivered successfully", entry.email, entry.consent_at)
        await deleteQueueFile(filepath)
      } else {
        entry.retry_count++
        entry.next_retry_at = calculateNextRetry(entry.retry_count).toISOString()
        await updateQueueEntry(filepath, entry)
        logWarn("Queued waitlist signup retry failed, scheduled for next attempt", entry.email, entry.consent_at, `RETRY_${entry.retry_count}`, {
          next_retry_at: entry.next_retry_at,
          error: result.error,
        })
      }
    }
  } catch (err) {
    logError("Queue worker error", undefined, undefined, "WORKER_ERROR", { error: err instanceof Error ? err.message : "Unknown error" })
  } finally {
    isRunning = false
  }
}

export function startWorker(): void {
  if (intervalId) return
  logInfo("Starting waitlist queue worker")
  intervalId = setInterval(() => {
    currentProcessingPromise = processQueue()
  }, WORKER_INTERVAL)
  currentProcessingPromise = processQueue()
}

export async function stopWorker(): Promise<void> {
  if (intervalId) {
    clearInterval(intervalId)
    intervalId = null
    // Wait for any in-flight processing to complete
    if (currentProcessingPromise) {
      await currentProcessingPromise
    }
    // Stop the rate limiter cleanup interval
    const { waitlistRateLimiter } = await import("@/lib/rate-limit")
    waitlistRateLimiter.stopCleanup()
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