// Copyright (c) 2026 Ironfeast Media, LLC. All rights reserved.
import { mkdir, writeFile } from "fs/promises"
import { join } from "path"
import { randomUUID } from "crypto"
import { encryptQueueEntry } from "./encryption"
import { hashEmail } from "./encryption"

export const QUEUE_DIR = process.env.WAITLIST_QUEUE_DIR ?? "/var/lib/veldsite/waitlist-queue"

export const MAX_QUEUE_FILES = parseInt(process.env.MAX_QUEUE_FILES ?? "10000", 10)
export const MAX_QUEUE_SIZE_MB = parseInt(process.env.MAX_QUEUE_SIZE_MB ?? "100", 10)
export const MAX_QUEUE_SIZE_BYTES = MAX_QUEUE_SIZE_MB * 1024 * 1024

export interface QueuedSubmission {
  idempotency_key: string
  email: string
  source?: string
  consent_at: string
  consent_version: string
  consent_text_hash: string
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  utm_term?: string
  utm_content?: string
  referrer?: string
  ip_hash?: string
  queued_at: string
  retry_count: number
  next_retry_at: string
}

export async function ensureQueueDir(): Promise<void> {
  await mkdir(QUEUE_DIR, { recursive: true, mode: 0o700 })
}

export async function writeQueueEntry(entry: Omit<QueuedSubmission, "idempotency_key" | "queued_at" | "retry_count" | "next_retry_at" | "ip_hash"> & { ip?: string }): Promise<string> {
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

  const now = new Date()
  const timestamp = now.toISOString().replace(/[:.]/g, "-")
  const filename = `${timestamp}.json.age`
  const filepath = join(QUEUE_DIR, filename)

  const ipHash = entry.ip ? hashEmail(entry.ip) : undefined

  const queuedEntry: QueuedSubmission = {
    ...entry,
    idempotency_key: randomUUID(),
    ip_hash: ipHash,
    queued_at: now.toISOString(),
    retry_count: 0,
    next_retry_at: now.toISOString(),
  }

  const encrypted = await encryptQueueEntry(queuedEntry)
  await writeFile(filepath, encrypted, { mode: 0o600 })

  return filepath
}