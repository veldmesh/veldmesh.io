// Copyright (c) 2026 Ironfeast Media, LLC. All rights reserved.
//
// Write path for the retry queue. The API route only ever needs to write
// entries; listing/reading/deleting lives in lib/queue-worker.ts (worker
// only) so filesystem scanning code stays out of the server bundle.
//
// Each entry is stored as a JSON envelope:
//   { "idempotency_key", "next_retry_at", "retry_count", "ciphertext", "email_hash?" }
// Only `ciphertext` is the age-encrypted signup payload. This host holds
// only the encryption public key, so the queue is opaque to the web server
// itself; the operator's server decrypts it with the matching private key.
// The `email_hash` field (optional) is stored unencrypted to allow the
// worker to log warnings about old entries without decrypting.
import { mkdir, writeFile } from "fs/promises"
import { join } from "path"
import { encryptQueueEntry, hashEmail } from "./encryption"
import type { MeshWaitlistPayload } from "./mesh"

export const QUEUE_DIR = process.env.WAITLIST_QUEUE_DIR ?? "/var/lib/veldsite/waitlist-queue"

export const MAX_QUEUE_FILES = parseInt(process.env.MAX_QUEUE_FILES ?? "10000", 10)
export const MAX_QUEUE_SIZE_MB = parseInt(process.env.MAX_QUEUE_SIZE_MB ?? "100", 10)
export const MAX_QUEUE_SIZE_BYTES = MAX_QUEUE_SIZE_MB * 1024 * 1024

export interface QueueEnvelope {
  idempotency_key: string
  next_retry_at: string
  retry_count: number
  ciphertext: string
  email_hash?: string
}

export type QueueEntryInput = MeshWaitlistPayload & { ip?: string }

export async function ensureQueueDir(): Promise<void> {
  await mkdir(QUEUE_DIR, { recursive: true, mode: 0o700 })
}

export function queueFilename(queuedAtMs: number, idempotencyKey: string): string {
  // Leading epoch timestamp: sortable, collision-free, and lets the worker
  // compute the age of entries without storing plaintext metadata in the envelope.
  return `${queuedAtMs}-${idempotencyKey}.json`
}

export async function writeQueueEntry(entry: QueueEntryInput): Promise<string> {
  await ensureQueueDir()

  // Check queue bounds using worker-only function
  const { getQueueStats } = await import("./queue-worker")
  const { fileCount, totalSize } = await getQueueStats()
  if (fileCount >= MAX_QUEUE_FILES) {
    throw new Error("QUEUE_FULL: Maximum number of queue files reached")
  }
  if (totalSize >= MAX_QUEUE_SIZE_BYTES) {
    throw new Error("QUEUE_FULL: Maximum queue size reached")
  }

  const now = Date.now()
  const { ip, ...payload } = entry

  // The salted IP hash is the only IP-derived value stored, and it lives
  // inside the encrypted payload.
  if (ip) {
    ;(payload as { ip_hash?: string }).ip_hash = hashEmail(ip)
  }

  // Compute email_hash for logging (worker can read this without decrypting)
  const emailHash = hashEmail(payload.email)

  const ciphertext = await encryptQueueEntry(payload)
  const envelope: QueueEnvelope = {
    idempotency_key: entry.idempotency_key,
    next_retry_at: new Date(now).toISOString(),
    retry_count: 0,
    ciphertext,
    email_hash: emailHash,
  }

  const filename = queueFilename(now, entry.idempotency_key)
  const filepath = join(QUEUE_DIR, filename)
  await writeFile(filepath, JSON.stringify(envelope), { mode: 0o600 })

  return filepath
}