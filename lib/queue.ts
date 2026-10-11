// Copyright (c) 2026 Ironfeast Media, LLC. All rights reserved.
import { mkdir, writeFile } from "fs/promises"
import { join } from "path"
import { encryptQueueEntry } from "./encryption"

export const QUEUE_DIR = process.env.WAITLIST_QUEUE_DIR ?? "/var/lib/veldsite/waitlist-queue"

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