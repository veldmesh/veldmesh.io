// Copyright (c) 2026 Ironfeast Media, LLC. All rights reserved.
import { describe, it, expect, beforeEach, afterEach, beforeAll } from "vitest"

// Test age key pair (generated for testing only)
// Public key: age1qhps403l6r56efhkfefu9pxmzyn96ea8c0m9pn3khm3m5cjdhg3spg730h
// Private key: AGE-SECRET-KEY-1D4SNGZQY8S3MAQWHUGMHZ6CXS2QNCT08X8CRPSH67N7S3GNLCRKSA8QYDG
process.env.QUEUE_ENCRYPTION_KEY = "age1qhps403l6r56efhkfefu9pxmzyn96ea8c0m9pn3khm3m5cjdhg3spg730h"
process.env.QUEUE_DECRYPTION_KEY = "AGE-SECRET-KEY-1D4SNGZQY8S3MAQWHUGMHZ6CXS2QNCT08X8CRPSH67N7S3GNLCRKSA8QYDG"
process.env.LOG_SALT = "test-salt"
process.env.WAITLIST_QUEUE_DIR = "/tmp/veldsite-test-waitlist-queue-queue-test"

let writeQueueEntry: typeof import("@/lib/queue").writeQueueEntry
let readQueueEntry: typeof import("@/lib/queue-worker").readQueueEntry
let listQueueFiles: typeof import("@/lib/queue-worker").listQueueFiles
let deleteQueueFile: typeof import("@/lib/queue-worker").deleteQueueFile
let updateQueueEntry: typeof import("@/lib/queue-worker").updateQueueEntry
let calculateNextRetry: typeof import("@/lib/queue-worker").calculateNextRetry
let isPermanentFailure: typeof import("@/lib/queue-worker").isPermanentFailure

beforeAll(async () => {
  const queueMod = await import("@/lib/queue")
  const queueWorkerMod = await import("@/lib/queue-worker")
  writeQueueEntry = queueMod.writeQueueEntry
  readQueueEntry = queueWorkerMod.readQueueEntry
  listQueueFiles = queueWorkerMod.listQueueFiles
  deleteQueueFile = queueWorkerMod.deleteQueueFile
  updateQueueEntry = queueWorkerMod.updateQueueEntry
  calculateNextRetry = queueWorkerMod.calculateNextRetry
  isPermanentFailure = queueWorkerMod.isPermanentFailure
})

const TEST_QUEUE_DIR = "/tmp/veldsite-test-waitlist-queue-queue-test"

describe("queue", () => {
  beforeEach(async () => {
    await import("fs/promises").then((fs) => fs.rm(TEST_QUEUE_DIR, { recursive: true, force: true }))
    await import("fs/promises").then((fs) => fs.mkdir(TEST_QUEUE_DIR, { recursive: true }))
  })

  afterEach(async () => {
    await import("fs/promises").then((fs) => fs.rm(TEST_QUEUE_DIR, { recursive: true, force: true }))
  })

  const sampleEntry = {
    email: "test@example.com",
    source: "test-source",
    consent_at: "2026-01-01T00:00:00.000Z",
    consent_version: "1.0",
    consent_text_hash: "abc123",
    utm_source: "google",
    utm_medium: "cpc",
    utm_campaign: "launch",
    utm_term: "test",
    utm_content: "banner",
    referrer: "https://example.com",
    ip_hash: "hash123",
  }

  it("writes and reads queue entries with encryption", async () => {
    const filepath = await writeQueueEntry(sampleEntry)
    expect(filepath).toContain(".json.age")

    const entry = await readQueueEntry(filepath)
    expect(entry).not.toBeNull()
    expect(entry!.email).toBe(sampleEntry.email)
    expect(entry!.source).toBe(sampleEntry.source)
    expect(entry!.consent_at).toBe(sampleEntry.consent_at)
    expect(entry!.consent_version).toBe(sampleEntry.consent_version)
    expect(entry!.consent_text_hash).toBe(sampleEntry.consent_text_hash)
    expect(entry!.utm_source).toBe(sampleEntry.utm_source)
    expect(entry!.referrer).toBe(sampleEntry.referrer)
    expect(entry!.queued_at).toBeDefined()
    expect(entry!.retry_count).toBe(0)
    expect(entry!.next_retry_at).toBeDefined()
  })

  it("queue file is not valid JSON (encrypted)", async () => {
    const filepath = await writeQueueEntry(sampleEntry)
    const rawContent = await import("fs/promises").then((fs) => fs.readFile(filepath, "utf-8"))
    
    expect(() => JSON.parse(rawContent)).toThrow()
    // File is base64 encoded, decode to check for age header
    const decoded = Buffer.from(rawContent, "base64").toString("utf-8")
    expect(decoded).toContain("age-encryption.org")
  })

  it("decryption recovers original fields", async () => {
    const filepath = await writeQueueEntry(sampleEntry)
    const entry = await readQueueEntry(filepath)
    
    expect(entry).not.toBeNull()
    expect(entry!.email).toBe(sampleEntry.email)
    expect(entry!.consent_version).toBe(sampleEntry.consent_version)
    expect(entry!.consent_text_hash).toBe(sampleEntry.consent_text_hash)
  })

  it("lists queue files", async () => {
    await writeQueueEntry({ ...sampleEntry, email: "a@example.com" })
    await writeQueueEntry({ ...sampleEntry, email: "b@example.com" })
    await writeQueueEntry({ ...sampleEntry, email: "c@example.com" })

    const files = await listQueueFiles()
    expect(files).toHaveLength(3)
  })

  it("deletes queue files", async () => {
    const filepath = await writeQueueEntry(sampleEntry)
    await deleteQueueFile(filepath)

    const entry = await readQueueEntry(filepath)
    expect(entry).toBeNull()
  })

  it("updates queue entries", async () => {
    const filepath = await writeQueueEntry(sampleEntry)
    const entry = await readQueueEntry(filepath)
    expect(entry!.retry_count).toBe(0)

    entry!.retry_count = 2
    entry!.next_retry_at = new Date(Date.now() + 60_000).toISOString()
    await updateQueueEntry(filepath, entry!)

    const updated = await readQueueEntry(filepath)
    expect(updated!.retry_count).toBe(2)
  })

  it("calculateNextRetry uses exponential backoff with max 5m", () => {
    const retry1 = calculateNextRetry(0)
    const retry2 = calculateNextRetry(1)
    const retry3 = calculateNextRetry(2)
    const retry10 = calculateNextRetry(10)

    expect(retry1.getTime() - Date.now()).toBeCloseTo(30_000, -3)
    expect(retry2.getTime() - Date.now()).toBeCloseTo(60_000, -3)
    expect(retry3.getTime() - Date.now()).toBeCloseTo(120_000, -3)
    expect(retry10.getTime() - Date.now()).toBeLessThanOrEqual(5 * 60 * 1000 + 1000)
  })

  it("isPermanentFailure returns true after 24h", () => {
    const oldEntry = {
      ...sampleEntry,
      queued_at: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
      retry_count: 5,
      next_retry_at: new Date().toISOString(),
    }
    expect(isPermanentFailure(oldEntry)).toBe(true)

    const newEntry = {
      ...sampleEntry,
      queued_at: new Date().toISOString(),
      retry_count: 5,
      next_retry_at: new Date().toISOString(),
    }
    expect(isPermanentFailure(newEntry)).toBe(false)
  })
})