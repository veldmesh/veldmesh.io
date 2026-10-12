// Copyright (c) 2026 Ironfeast Media, LLC. All rights reserved.
//
// Worker-only queue operations. Not imported by API routes (to keep
// filesystem scanning out of the server bundle). The worker never decrypts
// entries — this host holds only the encryption public key. It forwards the
// ciphertext to the operator's server, which holds the private key and
// deduplicates retries by idempotency_key.
import { readFile, readdir, unlink, writeFile, stat } from "fs/promises"
import { basename, join } from "path"
import { postQueuedToMesh } from "./mesh"
import { logError, logInfo, logWarn } from "./logging"
import { QueueEnvelope, ensureQueueDir, QUEUE_DIR } from "./queue"

const RETRY_BASE_DELAY_MS = 30_000
const RETRY_MAX_DELAY_MS = 5 * 60 * 1000
const ENTRY_EXPIRY_MS = 24 * 60 * 60 * 1000

export async function readQueueEnvelope(filepath: string): Promise<QueueEnvelope | null> {
  try {
    const raw = await readFile(filepath, "utf-8")
    const envelope = JSON.parse(raw) as QueueEnvelope
    if (
      typeof envelope.idempotency_key !== "string" ||
      typeof envelope.next_retry_at !== "string" ||
      typeof envelope.retry_count !== "number" ||
      typeof envelope.ciphertext !== "string"
    ) {
      return null
    }
    return envelope
  } catch {
    return null
  }
}

export async function listQueueFiles(): Promise<string[]> {
  await ensureQueueDir()
  const files = await readdir(QUEUE_DIR)
  return files
    .filter((f) => f.endsWith(".json"))
    .map((f) => join(QUEUE_DIR, f))
    .sort()
}

export async function deleteQueueFile(filepath: string): Promise<void> {
  try {
    await unlink(filepath)
  } catch {
    // File might already be deleted
  }
}

export async function updateQueueEnvelope(filepath: string, envelope: QueueEnvelope): Promise<void> {
  await writeFile(filepath, JSON.stringify(envelope), { mode: 0o600 })
}

/** Delay before the next retry: 30s * 2^retryCount, capped at 5 minutes. */
export function calculateNextRetry(retryCount: number): Date {
  const delay = Math.min(RETRY_BASE_DELAY_MS * Math.pow(2, retryCount), RETRY_MAX_DELAY_MS)
  return new Date(Date.now() + delay)
}

/** Queued-at timestamp parsed from the filename (leading epoch millis). */
export function queuedAtFromFilename(filepath: string): number | null {
  const match = basename(filepath).match(/^(\d{13,})-/)
  if (!match) return null
  const ms = parseInt(match[1], 10)
  return Number.isFinite(ms) ? ms : null
}

/** Entries older than 24h are permanent failures and must not be retried forever. */
export function isPermanentFailure(filepath: string, now: number = Date.now()): boolean {
  const queuedAt = queuedAtFromFilename(filepath)
  if (queuedAt === null) return false // unparseable name — let the corruption handler deal with it
  return now - queuedAt > ENTRY_EXPIRY_MS
}

export async function getQueueStats(): Promise<{ fileCount: number; totalSize: number }> {
  try {
    const files = await readdir(QUEUE_DIR)
    let totalSize = 0
    let fileCount = 0
    for (const file of files) {
      if (file.endsWith(".json")) {
        fileCount++
        const stats = await stat(join(QUEUE_DIR, file))
        totalSize += stats.size
      }
    }
    return { fileCount, totalSize }
  } catch {
    return { fileCount: 0, totalSize: 0 }
  }
}

/**
 * One pass over the queue: deliver due entries to the operator's server,
 * back off retryable failures, and remove finished or expired entries.
 * Expiry and permanent rejections are logged at ERROR with their
 * idempotency_key — never silently dropped.
 */
export async function processQueue(now: Date = new Date()): Promise<void> {
  const files = await listQueueFiles()

  for (const filepath of files) {
    const envelope = await readQueueEnvelope(filepath)
    if (!envelope) {
      logWarn("Failed to read queue entry, deleting corrupted file", undefined, undefined, "QUEUE_READ_FAILED", { file: basename(filepath) })
      await deleteQueueFile(filepath)
      continue
    }

    if (now.getTime() < new Date(envelope.next_retry_at).getTime()) {
      continue
    }

    if (isPermanentFailure(filepath, now.getTime())) {
      logError("Queue entry expired after 24h — permanent failure", undefined, undefined, "QUEUE_EXPIRED", {
        idempotency_key: envelope.idempotency_key,
        retry_count: envelope.retry_count,
        file: basename(filepath),
      })
      await deleteQueueFile(filepath)
      continue
    }

    const result = await postQueuedToMesh(envelope.idempotency_key, envelope.ciphertext)

    if (result.ok) {
      logInfo("Queued waitlist submission delivered", undefined, undefined, { idempotency_key: envelope.idempotency_key })
      await deleteQueueFile(filepath)
      continue
    }

    if (result.retryable) {
      const nextRetry = calculateNextRetry(envelope.retry_count)
      envelope.retry_count++
      envelope.next_retry_at = nextRetry.toISOString()
      await updateQueueEnvelope(filepath, envelope)
      logWarn("Queued waitlist submission retry failed, rescheduled", undefined, undefined, `MESH_RETRY_${result.status ?? 0}`, {
        idempotency_key: envelope.idempotency_key,
        retry_count: envelope.retry_count,
        next_retry_at: envelope.next_retry_at,
      })
    } else {
      // Permanent rejection: the operator's server will never accept this
      // entry. Log at ERROR with the idempotency key so it can be traced,
      // then remove it from the queue.
      logError("Queued waitlist submission permanently rejected", undefined, undefined, `MESH_PERMANENT_${result.status ?? 0}`, {
        idempotency_key: envelope.idempotency_key,
        retry_count: envelope.retry_count,
      })
      await deleteQueueFile(filepath)
    }
  }
}
