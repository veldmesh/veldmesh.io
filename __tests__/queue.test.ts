// Copyright (c) 2026 Ironfeast Media, LLC. All rights reserved.
import { describe, it, expect, beforeEach, afterEach, beforeAll, vi } from "vitest"
import { Decrypter, generateIdentity, identityToRecipient } from "age-encryption"

// Generate a fresh age key pair for each test run — no secrets committed.
let TEST_PUBLIC_KEY: string
let TEST_PRIVATE_KEY: string

beforeAll(async () => {
  const privateKey = await generateIdentity()
  const publicKey = await identityToRecipient(privateKey)
  TEST_PUBLIC_KEY = publicKey
  TEST_PRIVATE_KEY = privateKey

  process.env.QUEUE_ENCRYPTION_KEY = TEST_PUBLIC_KEY
  process.env.LOG_SALT = "test-salt"
  process.env.WAITLIST_QUEUE_DIR = "/tmp/veldsite-test-waitlist-queue-queue-test"
  process.env.MAX_QUEUE_FILES = "5"
})

const TEST_QUEUE_DIR = "/tmp/veldsite-test-waitlist-queue-queue-test"

let writeQueueEntry: typeof import("@/lib/queue").writeQueueEntry
let readQueueEnvelope: typeof import("@/lib/queue-worker").readQueueEnvelope
let listQueueFiles: typeof import("@/lib/queue-worker").listQueueFiles
let deleteQueueFile: typeof import("@/lib/queue-worker").deleteQueueFile
let updateQueueEnvelope: typeof import("@/lib/queue-worker").updateQueueEnvelope
let calculateNextRetry: typeof import("@/lib/queue-worker").calculateNextRetry
let isPermanentFailure: typeof import("@/lib/queue-worker").isPermanentFailure
let hashEmail: typeof import("@/lib/encryption").hashEmail
let moveToRejected: typeof import("@/lib/queue-worker").moveToRejected
let moveToCorrupt: typeof import("@/lib/queue-worker").moveToCorrupt
let REJECTED_DIR: typeof import("@/lib/queue-worker").REJECTED_DIR
let CORRUPT_DIR: typeof import("@/lib/queue-worker").CORRUPT_DIR

beforeAll(async () => {
  const queueMod = await import("@/lib/queue")
  const queueWorkerMod = await import("@/lib/queue-worker")
  const encryptionMod = await import("@/lib/encryption")
  writeQueueEntry = queueMod.writeQueueEntry
  readQueueEnvelope = queueWorkerMod.readQueueEnvelope
  listQueueFiles = queueWorkerMod.listQueueFiles
  deleteQueueFile = queueWorkerMod.deleteQueueFile
  updateQueueEnvelope = queueWorkerMod.updateQueueEnvelope
  calculateNextRetry = queueWorkerMod.calculateNextRetry
  isPermanentFailure = queueWorkerMod.isPermanentFailure
  hashEmail = encryptionMod.hashEmail
  moveToRejected = queueWorkerMod.moveToRejected
  moveToCorrupt = queueWorkerMod.moveToCorrupt
  REJECTED_DIR = queueWorkerMod.REJECTED_DIR
  CORRUPT_DIR = queueWorkerMod.CORRUPT_DIR
})

async function decryptForTest(ciphertext: string): Promise<Record<string, unknown>> {
  const decrypter = new Decrypter()
  decrypter.addIdentity(TEST_PRIVATE_KEY)
  const plaintext = await decrypter.decrypt(new Uint8Array(Buffer.from(ciphertext, "base64")), "text")
  return JSON.parse(plaintext)
}

const sampleEntry = {
  idempotency_key: "11111111-2222-3333-4444-555555555555",
  email: "test@example.com",
  source: "home",
  consent_at: "2026-01-01T00:00:00.000Z",
  consent_version: "1.0",
  consent_text_hash: "abc123",
  consent_label: "I agree to receive updates from Veldmesh and understand I can unsubscribe at any time.",
  utm_source: "google",
  utm_medium: "cpc",
  utm_campaign: "launch",
  utm_term: "test",
  utm_content: "banner",
  referrer: "https://example.com",
}

async function fileExists(path: string): Promise<boolean> {
  const fs = await import("fs/promises")
  try {
    await fs.stat(path)
    return true
  } catch {
    return false
  }
}

describe("queue", () => {
  beforeEach(async () => {
    const fs = await import("fs/promises")
    await fs.rm(TEST_QUEUE_DIR, { recursive: true, force: true })
    await fs.mkdir(TEST_QUEUE_DIR, { recursive: true })
    await fs.mkdir(`${TEST_QUEUE_DIR}/rejected`, { recursive: true })
    await fs.mkdir(`${TEST_QUEUE_DIR}/corrupt`, { recursive: true })
  })

  afterEach(async () => {
    const fs = await import("fs/promises")
    await fs.rm(TEST_QUEUE_DIR, { recursive: true, force: true })
  })

  it("writes entries as {idempotency_key, next_retry_at, retry_count, ciphertext, email_hash} envelopes", async () => {
    const filepath = await writeQueueEntry(sampleEntry)
    expect(filepath).toMatch(/\.json$/)

    const envelope = await readQueueEnvelope(filepath)
    expect(envelope).not.toBeNull()
    expect(envelope!.idempotency_key).toBe(sampleEntry.idempotency_key)
    expect(envelope!.retry_count).toBe(0)
    expect(envelope!.next_retry_at).toBeDefined()
    expect(typeof envelope!.ciphertext).toBe("string")
    expect(envelope!.email_hash).toBeDefined()
    expect(envelope!.email_hash).toBe(hashEmail(sampleEntry.email))
    expect(Object.keys(envelope!).sort()).toEqual(["ciphertext", "email_hash", "idempotency_key", "next_retry_at", "retry_count"])
  })

  it("queue file contains no plaintext personal data", async () => {
    const filepath = await writeQueueEntry(sampleEntry)
    const fs = await import("fs/promises")
    const raw = await fs.readFile(filepath, "utf-8")

    // The envelope itself is JSON, but must not leak any signup fields.
    const parsed = JSON.parse(raw)
    expect(Object.keys(parsed).sort()).toEqual(["ciphertext", "email_hash", "idempotency_key", "next_retry_at", "retry_count"])
    expect(raw).not.toContain("test@example.com")
    expect(raw).not.toContain("google")
    expect(parsed.ciphertext).not.toContain("test@example.com")

    // The ciphertext is age-encrypted, not JSON.
    expect(() => JSON.parse(parsed.ciphertext)).toThrow()
    const decoded = Buffer.from(parsed.ciphertext, "base64").toString("utf-8")
    expect(decoded).toContain("age-encryption.org")
    expect(decoded).not.toContain("test@example.com")
  })

  it("decryption (on the operator's server) recovers the original fields", async () => {
    const filepath = await writeQueueEntry({ ...sampleEntry, ip: "203.0.113.10" })
    const envelope = await readQueueEnvelope(filepath)
    expect(envelope).not.toBeNull()

    const payload = await decryptForTest(envelope!.ciphertext)
    expect(payload.email).toBe(sampleEntry.email)
    expect(payload.source).toBe(sampleEntry.source)
    expect(payload.consent_at).toBe(sampleEntry.consent_at)
    expect(payload.consent_version).toBe(sampleEntry.consent_version)
    expect(payload.consent_text_hash).toBe(sampleEntry.consent_text_hash)
    expect(payload.utm_source).toBe(sampleEntry.utm_source)
    expect(payload.utm_medium).toBe(sampleEntry.utm_medium)
    expect(payload.utm_campaign).toBe(sampleEntry.utm_campaign)
    expect(payload.utm_term).toBe(sampleEntry.utm_term)
    expect(payload.utm_content).toBe(sampleEntry.utm_content)
    expect(payload.referrer).toBe(sampleEntry.referrer)
    expect(payload.idempotency_key).toBe(sampleEntry.idempotency_key)
  })

  it("stores the client IP only as a salted hash inside the encrypted payload", async () => {
    const filepath = await writeQueueEntry({ ...sampleEntry, ip: "203.0.113.10" })
    const envelope = await readQueueEnvelope(filepath)
    const payload = await decryptForTest(envelope!.ciphertext)

    expect(payload.ip_hash).toBe(hashEmail("203.0.113.10"))
  })

  it("omits ip_hash when no IP is provided", async () => {
    const filepath = await writeQueueEntry(sampleEntry)
    const envelope = await readQueueEnvelope(filepath)
    const payload = await decryptForTest(envelope!.ciphertext)

    expect(payload.ip_hash).toBeUndefined()
  })

  it("envelope includes email_hash for worker logging without decryption", async () => {
    const filepath = await writeQueueEntry(sampleEntry)
    const envelope = await readQueueEnvelope(filepath)
    expect(envelope!.email_hash).toBe(hashEmail(sampleEntry.email))
  })

  it("lists, updates and deletes queue entries", async () => {
    const a = await writeQueueEntry(sampleEntry)
    const b = await writeQueueEntry({ ...sampleEntry, idempotency_key: "aaaaaaaa-2222-3333-4444-555555555555" })
    const files = await listQueueFiles()
    expect(files).toHaveLength(2)

    const envelope = await readQueueEnvelope(a)
    envelope!.retry_count = 2
    envelope!.next_retry_at = new Date(Date.now() + 60_000).toISOString()
    await updateQueueEnvelope(a, envelope!)

    const updated = await readQueueEnvelope(a)
    expect(updated!.retry_count).toBe(2)
    // ciphertext is carried over untouched on update
    expect(updated!.ciphertext).toBe(envelope!.ciphertext)

    await deleteQueueFile(b)
    expect(await readQueueEnvelope(b)).toBeNull()
    expect(await listQueueFiles()).toHaveLength(1)
  })

  it("returns null for corrupted files", async () => {
    const fs = await import("fs/promises")
    const { join } = await import("path")
    const filepath = join(TEST_QUEUE_DIR, "1234567890123-corrupt.json")
    await fs.writeFile(filepath, "not-json", "utf-8")
    expect(await readQueueEnvelope(filepath)).toBeNull()
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

  it("isPermanentFailure returns false (no 24h expiry)", async () => {
    await writeQueueEntry(sampleEntry)
    expect(isPermanentFailure()).toBe(false)

    const { join } = await import("path")
    const oldMs = Date.now() - 25 * 60 * 60 * 1000
    join(TEST_QUEUE_DIR, `${oldMs}-old-uuid.json`)
    expect(isPermanentFailure()).toBe(false)

    // Unparseable filenames are NOT treated as permanent failures
    join(TEST_QUEUE_DIR, "not-a-timestamp.json")
    expect(isPermanentFailure()).toBe(false)
  })

  it("rejects new entries when the queue is full (QUEUE_FULL) by file count", async () => {
    const fs = await import("fs/promises")
    const { join } = await import("path")
    // MAX_QUEUE_FILES=5 in this test file's environment
    for (let i = 0; i < 5; i++) {
      await fs.writeFile(join(TEST_QUEUE_DIR, `${1700000000000 + i}-filler.json`), "{}", "utf-8")
    }

    await expect(writeQueueEntry(sampleEntry)).rejects.toThrow("QUEUE_FULL")
  })

  it("rejects new entries when the queue is full (QUEUE_FULL) by size limit", async () => {
    const fs = await import("fs/promises")
    const { join } = await import("path")
    // Create a couple of entries first
    await writeQueueEntry(sampleEntry)
    await writeQueueEntry({ ...sampleEntry, idempotency_key: "size-test-2" })

    // Set size limit very small (1KB)
    const originalSizeLimit = process.env.MAX_QUEUE_SIZE_MB
    vi.stubEnv("MAX_QUEUE_SIZE_MB", "0.001")
    vi.resetModules()
    const queueMod = await import("@/lib/queue")
    writeQueueEntry = queueMod.writeQueueEntry

    // Write a file that exceeds the tiny limit
    await fs.writeFile(join(TEST_QUEUE_DIR, `${Date.now()}-large.json`), "x".repeat(2048), "utf-8")

    await expect(writeQueueEntry({ ...sampleEntry, idempotency_key: "size-test-3" })).rejects.toThrow("QUEUE_FULL")

    // Restore original limit
    if (originalSizeLimit !== undefined) {
      vi.stubEnv("MAX_QUEUE_SIZE_MB", originalSizeLimit)
    } else {
      vi.unstubAllEnvs()
    }
    vi.resetModules()
    const restoredMod = await import("@/lib/queue")
    writeQueueEntry = restoredMod.writeQueueEntry
  })

  it("moveToRejected moves file to rejected/ subdirectory", async () => {
    const filepath = await writeQueueEntry(sampleEntry)
    await moveToRejected(filepath)

    expect(await fileExists(filepath)).toBe(false) // original gone
    const { basename, join } = await import("path")
    const rejectedPath = join(REJECTED_DIR, basename(filepath))
    expect(await fileExists(rejectedPath)).toBe(true)
  })

  it("moveToCorrupt moves file to corrupt/ subdirectory", async () => {
    const fs = await import("fs/promises")
    const { join, basename } = await import("path")
    const filepath = join(TEST_QUEUE_DIR, `${Date.now()}-corrupt.json`)
    await fs.writeFile(filepath, "not-json", "utf-8")

    await moveToCorrupt(filepath)

    expect(await fileExists(filepath)).toBe(false) // original gone
    const corruptPath = join(CORRUPT_DIR, basename(filepath))
    expect(await fileExists(corruptPath)).toBe(true)
  })

  it("serializes concurrent writes to enforce queue bounds (no race condition)", async () => {
    const fs = await import("fs/promises")
    const { join } = await import("path")
    // MAX_QUEUE_FILES=5 in this test file's environment
    // Pre-fill with 3 files, leaving 2 slots
    for (let i = 0; i < 3; i++) {
      await fs.writeFile(join(TEST_QUEUE_DIR, `${1700000000000 + i}-filler.json`), "{}", "utf-8")
    }

    // Fire 4 concurrent writes — only 2 should succeed
    const entries = [
      { ...sampleEntry, idempotency_key: "concurrent-1" },
      { ...sampleEntry, idempotency_key: "concurrent-2" },
      { ...sampleEntry, idempotency_key: "concurrent-3" },
      { ...sampleEntry, idempotency_key: "concurrent-4" },
    ]

    const results = await Promise.allSettled(entries.map((e) => writeQueueEntry(e)))
    const successful = results.filter((r) => r.status === "fulfilled").length
    const failed = results.filter((r) => r.status === "rejected").length

    // With mutex serialization, exactly 2 should succeed (slots 4 and 5),
    // and 2 should fail with QUEUE_FULL
    expect(successful).toBe(2)
    expect(failed).toBe(2)
    expect(results.filter((r) => r.status === "rejected" && r.reason?.message?.startsWith("QUEUE_FULL")).length).toBe(2)

    // Total files should be exactly 5 (3 fillers + 2 new)
    const allFiles = await fs.readdir(TEST_QUEUE_DIR)
    const jsonFiles = allFiles.filter((f) => f.endsWith(".json"))
    expect(jsonFiles).toHaveLength(5)
  })
})
