// Copyright (c) 2026 Ironfeast Media, LLC. All rights reserved.
//
// Worker-only queue operations. Not imported by API routes (to keep
// filesystem scanning out of the server bundle). The worker never decrypts
// entries — this host holds only the encryption public key. It forwards the
// ciphertext to the operator's server, which holds the private key and
// deduplicates retries by idempotency_key.
import { mkdir, readFile, readdir, rename, stat, unlink, writeFile } from "fs/promises"
import { basename, join } from "path"
import { postQueuedToMesh } from "./mesh"
import { logError, logInfo, logWarn } from "./logging"
import { QueueEnvelope, ensureQueueDir, QUEUE_DIR } from "./queue"

const RETRY_BASE_DELAY_MS = 30_000
const RETRY_MAX_DELAY_MS = 5 * 60 * 1000
const WARN_INTERVAL_MS = 60 * 60 * 1000 // 1 hour

export const REJECTED_DIR = join(QUEUE_DIR, "rejected")
export const CORRUPT_DIR = join(QUEUE_DIR, "corrupt")

// Track when we last warned about each old entry (by idempotency_key) to rate-limit WARN logs
const oldEntryWarnedAt = new Map<string, number>()

/** Reset the old-entry warning tracker (test helper). */
export function resetOldEntryWarningTracker(): void {
  oldEntryWarnedAt.clear()
}

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

/** Entries with unparseable filenames are NOT treated as permanent failures. */
export function isPermanentFailure(): boolean {
  // No 24h expiry anymore — entries are retried forever with capped backoff.
  // Permanent failures are determined by the mesh response (4xx validation errors).
  return false
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

async function ensureSubdirs(): Promise<void> {
  await mkdir(REJECTED_DIR, { recursive: true, mode: 0o700 })
  await mkdir(CORRUPT_DIR, { recursive: true, mode: 0o700 })
}

/**
 * Move a queue file to the rejected subdirectory (for permanent 4xx rejections).
 */
export async function moveToRejected(filepath: string): Promise<void> {
  await ensureSubdirs()
  const dest = join(REJECTED_DIR, basename(filepath))
  await rename(filepath, dest)
}

/**
 * Move a corrupted/unreadable queue file to the corrupt subdirectory.
 */
export async function moveToCorrupt(filepath: string): Promise<void> {
  await ensureSubdirs()
  const dest = join(CORRUPT_DIR, basename(filepath))
  await rename(filepath, dest)
}

/**
 * Check if an entry is older than 24h and log a WARN once per hour (email_hash only).
 */
async function maybeWarnOldEntry(envelope: QueueEnvelope, queuedAt: number, now: number): Promise<void> {
  const ageMs = now - queuedAt
  if (ageMs <= 24 * 60 * 60 * 1000) {
    return
  }

  const key = envelope.idempotency_key
  const lastWarned = oldEntryWarnedAt.get(key) ?? 0
  if (now - lastWarned < WARN_INTERVAL_MS) {
    return
  }

  logWarn("Queue entry older than 24h — still retrying", undefined, undefined, "QUEUE_OLD_ENTRY", {
    idempotency_key: key,
    retry_count: envelope.retry_count,
    age_hours: Math.floor(ageMs / (60 * 60 * 1000)),
    email_hash: envelope.email_hash,
  })

  oldEntryWarnedAt.set(key, now)
}

/**
 * One pass over the queue: deliver due entries to the operator's server,
 * back off retryable failures, move permanent rejections to rejected/,
 * move corrupted files to corrupt/, and warn about old entries.
 * Only 2xx responses delete queue files.
 */
export async function processQueue(now: Date = new Date()): Promise<void> {
  const files = await listQueueFiles()
  const nowMs = now.getTime()

  for (const filepath of files) {
    const envelope = await readQueueEnvelope(filepath)
    if (!envelope) {
      logWarn("Failed to read queue entry, moving to corrupt/", undefined, undefined, "QUEUE_READ_FAILED", { file: basename(filepath) })
      await moveToCorrupt(filepath)
      continue
    }

    // Warn about old entries (once per hour per entry) regardless of retry status
    const queuedAt = queuedAtFromFilename(filepath)
    if (queuedAt !== null) {
      await maybeWarnOldEntry(envelope, queuedAt, nowMs)
    }

    if (nowMs < new Date(envelope.next_retry_at).getTime()) {
      continue
    }

    const result = await postQueuedToMesh(envelope.idempotency_key, envelope.ciphertext)

    if (result.ok) {
      logInfo("Queued waitlist submission delivered", undefined, undefined, { idempotency_key: envelope.idempotency_key })
      await deleteQueueFile(filepath)
      // Clean up warning tracker for this entry
      oldEntryWarnedAt.delete(envelope.idempotency_key)
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
      // Permanent rejection (4xx validation error from operator's server):
      // move to rejected/ (still encrypted), log ERROR with email_hash and status.
      logError("Queued waitlist submission permanently rejected", undefined, undefined, `MESH_PERMANENT_${result.status ?? 0}`, {
        idempotency_key: envelope.idempotency_key,
        retry_count: envelope.retry_count,
        status: result.status,
        email_hash: envelope.email_hash,
      })

      await moveToRejected(filepath)
      // Clean up warning tracker for this entry
      oldEntryWarnedAt.delete(envelope.idempotency_key)
    }
  }
}