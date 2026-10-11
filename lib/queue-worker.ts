// Copyright (c) 2026 Ironfeast Media, LLC. All rights reserved.
// Worker-only queue operations - not imported by API routes to avoid Turbopack filesystem tracing
import { readFile, readdir, unlink, writeFile } from "fs/promises"
import { join } from "path"
import { decryptQueueEntry, encryptQueueEntry } from "./encryption"
import { QueuedSubmission, ensureQueueDir, QUEUE_DIR } from "./queue"

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