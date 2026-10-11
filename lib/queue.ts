// Copyright (c) 2026 Ironfeast Media, LLC. All rights reserved.
import { mkdir, writeFile, readFile, readdir, unlink, stat } from "fs/promises"
import { join } from "path"
import { encryptQueueEntry, decryptQueueEntry } from "./encryption"

const QUEUE_DIR = process.env.WAITLIST_QUEUE_DIR ?? "/var/lib/veldsite/waitlist-queue"

export interface QueuedSubmission {
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

export async function writeQueueEntry(entry: Omit<QueuedSubmission, "queued_at" | "retry_count" | "next_retry_at">): Promise<string> {
  await ensureQueueDir()

  const now = new Date()
  const timestamp = now.toISOString().replace(/[:.]/g, "-")
  const filename = `${timestamp}.json.age`
  const filepath = join(QUEUE_DIR, filename)

  const queuedEntry: QueuedSubmission = {
    ...entry,
    queued_at: now.toISOString(),
    retry_count: 0,
    next_retry_at: now.toISOString(),
  }

  const encrypted = await encryptQueueEntry(queuedEntry)
  await writeFile(filepath, encrypted, { mode: 0o600 })

  return filepath
}

export async function readQueueEntry(filepath: string): Promise<QueuedSubmission | null> {
  try {
    const encrypted = await readFile(filepath, "utf-8")
    const decrypted = await decryptQueueEntry(encrypted)
    return decrypted as QueuedSubmission
  } catch {
    return null
  }
}

export async function listQueueFiles(): Promise<string[]> {
  await ensureQueueDir()
  const files = await readdir(QUEUE_DIR)
  return files
    .filter((f) => f.endsWith(".json.age"))
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

export async function updateQueueEntry(filepath: string, entry: QueuedSubmission): Promise<void> {
  const encrypted = await encryptQueueEntry(entry)
  await writeFile(filepath, encrypted, { mode: 0o600 })
}

export function calculateNextRetry(retryCount: number): Date {
  const baseDelay = 30_000
  const maxDelay = 5 * 60 * 1000
  const delay = Math.min(baseDelay * Math.pow(2, retryCount), maxDelay)
  return new Date(Date.now() + delay)
}

export function isPermanentFailure(entry: QueuedSubmission): boolean {
  const queuedAt = new Date(entry.queued_at).getTime()
  const now = Date.now()
  return now - queuedAt > 24 * 60 * 60 * 1000
}