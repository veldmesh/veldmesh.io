// Copyright (c) 2026 Ironfeast Media, LLC. All rights reserved.
import { describe, it, expect, beforeEach, afterEach, vi, beforeAll } from "vitest"
import { generateIdentity, identityToRecipient } from "age-encryption"

// Generate a fresh age key pair for each test run — no secrets committed.
beforeAll(async () => {
  const privateKey = await generateIdentity()
  const publicKey = await identityToRecipient(privateKey)

  process.env.QUEUE_ENCRYPTION_KEY = publicKey
  process.env.LOG_SALT = "test-salt"
  process.env.WAITLIST_QUEUE_DIR = "/tmp/veldsite-test-waitlist-queue-worker-test"
  // Provide private key for decryptQueueEntryForLogging in tests
  process.env.AGE_SECRET_KEY = privateKey
})

const TEST_QUEUE_DIR = "/tmp/veldsite-test-waitlist-queue-worker-test"

vi.mock("@/lib/mesh", () => ({
  postQueuedToMesh: vi.fn(),
}))

let processQueue: typeof import("@/lib/queue-worker").processQueue
let listQueueFiles: typeof import("@/lib/queue-worker").listQueueFiles
let readQueueEnvelope: typeof import("@/lib/queue-worker").readQueueEnvelope
let isPermanentFailure: typeof import("@/lib/queue-worker").isPermanentFailure
let resetOldEntryWarningTracker: typeof import("@/lib/queue-worker").resetOldEntryWarningTracker
let postQueuedToMesh: ReturnType<typeof vi.fn>

beforeAll(async () => {
  const queueWorkerMod = await import("@/lib/queue-worker")
  const meshMod = await import("@/lib/mesh")
  processQueue = queueWorkerMod.processQueue
  listQueueFiles = queueWorkerMod.listQueueFiles
  readQueueEnvelope = queueWorkerMod.readQueueEnvelope
  isPermanentFailure = queueWorkerMod.isPermanentFailure
  resetOldEntryWarningTracker = queueWorkerMod.resetOldEntryWarningTracker
  postQueuedToMesh = meshMod.postQueuedToMesh as unknown as ReturnType<typeof vi.fn>
})

async function writeEnvelopeFile(filename: string, envelope: Record<string, unknown>): Promise<string> {
  const fs = await import("fs/promises")
  const { join } = await import("path")
  const filepath = join(TEST_QUEUE_DIR, filename)
  await fs.writeFile(filepath, JSON.stringify(envelope), "utf-8")
  return filepath
}

function envelope(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    idempotency_key: "key-1",
    next_retry_at: new Date(Date.now() - 1000).toISOString(), // due now
    retry_count: 0,
    ciphertext: "encrypted-payload",
    email_hash: "test-hash",
    ...overrides,
  }
}

describe("waitlist queue worker", () => {
  let consoleError: ReturnType<typeof vi.spyOn>
  let consoleWarn: ReturnType<typeof vi.spyOn>
  let consoleLog: ReturnType<typeof vi.spyOn>

  beforeEach(async () => {
    const fs = await import("fs/promises")
    await fs.rm(TEST_QUEUE_DIR, { recursive: true, force: true })
    await fs.mkdir(TEST_QUEUE_DIR, { recursive: true })
    await fs.mkdir(`${TEST_QUEUE_DIR}/rejected`, { recursive: true })
    await fs.mkdir(`${TEST_QUEUE_DIR}/corrupt`, { recursive: true })
    postQueuedToMesh.mockReset()
    resetOldEntryWarningTracker()
    consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {})
    consoleLog = vi.spyOn(console, "log").mockImplementation(() => {})
  })

  afterEach(async () => {
    const fs = await import("fs/promises")
    await fs.rm(TEST_QUEUE_DIR, { recursive: true, force: true })
    vi.restoreAllMocks()
  })

  it("delivers due entries to POST /api/waitlist/queued and deletes them on 2xx", async () => {
    const filepath = await writeEnvelopeFile(`${Date.now()}-key-1.json`, envelope())
    postQueuedToMesh.mockResolvedValue({ ok: true, status: 200, retryable: false })

    await processQueue()

    expect(postQueuedToMesh).toHaveBeenCalledTimes(1)
    expect(postQueuedToMesh).toHaveBeenCalledWith("key-1", "encrypted-payload")
    expect(await listQueueFiles()).toHaveLength(0)
    expect(consoleLog).toHaveBeenCalled()
    void filepath
  })

  it("schedules an exponential backoff retry on retryable failure (network error, 5xx, 408, 429)", async () => {
    const filepath = await writeEnvelopeFile(`${Date.now()}-key-1.json`, envelope())
    postQueuedToMesh.mockResolvedValue({ ok: false, status: 503, retryable: true })

    await processQueue()

    expect(await listQueueFiles()).toHaveLength(1)
    const updated = await readQueueEnvelope(filepath)
    expect(updated!.retry_count).toBe(1)
    // first retry: 30s backoff
    expect(new Date(updated!.next_retry_at).getTime()).toBeCloseTo(Date.now() + 30_000, -2)
    expect(consoleWarn).toHaveBeenCalled()
  })

  it("does not retry entries whose next_retry_at is in the future", async () => {
    await writeEnvelopeFile(
      `${Date.now()}-key-1.json`,
      envelope({ next_retry_at: new Date(Date.now() + 60_000).toISOString() })
    )

    await processQueue()

    expect(postQueuedToMesh).not.toHaveBeenCalled()
    expect(await listQueueFiles()).toHaveLength(1)
  })

  it("moves permanently rejected entries to rejected/ and logs at ERROR with the idempotency_key", async () => {
    await writeEnvelopeFile(`${Date.now()}-key-1.json`, envelope())
    postQueuedToMesh.mockResolvedValue({ ok: false, status: 400, retryable: false })

    await processQueue()

    // File moved to rejected/, not deleted
    expect(await listQueueFiles()).toHaveLength(0)
    const fs = await import("fs/promises")
    const rejectedFiles = await fs.readdir(`${TEST_QUEUE_DIR}/rejected`)
    expect(rejectedFiles).toHaveLength(1)
    expect(consoleError).toHaveBeenCalled()
    const logged = JSON.stringify(consoleError.mock.calls)
    expect(logged).toContain("key-1")
    expect(logged).toContain("MESH_PERMANENT_400")
    expect(logged).toContain("test-hash") // email_hash in log
  })

  it("does NOT expire entries after 24h — they continue to be retried", async () => {
    const oldMs = Date.now() - 25 * 60 * 60 * 1000
    await writeEnvelopeFile(`${oldMs}-key-1.json`, envelope())

    // Mock a retryable failure so we can verify it gets rescheduled
    postQueuedToMesh.mockResolvedValue({ ok: false, status: 500, retryable: true })

    await processQueue()

    // Entry should still exist and be rescheduled (not deleted)
    expect(postQueuedToMesh).toHaveBeenCalled()
    expect(await listQueueFiles()).toHaveLength(1)
    const updated = await readQueueEnvelope((await listQueueFiles())[0])
    expect(updated!.retry_count).toBe(1)
  })

  it("logs WARN once per hour for entries older than 24h", async () => {
    const oldMs = Date.now() - 25 * 60 * 60 * 1000
    await writeEnvelopeFile(`${oldMs}-key-1.json`, envelope({ idempotency_key: "old-key-1", next_retry_at: new Date(Date.now() - 1000).toISOString() }))

    postQueuedToMesh.mockResolvedValue({ ok: false, status: 500, retryable: true })

    await processQueue()

    // Should log WARN about old entry
    const warnCalls = consoleWarn.mock.calls.filter((call) => JSON.stringify(call).includes("QUEUE_OLD_ENTRY"))
    expect(warnCalls.length).toBeGreaterThanOrEqual(1)
  })

  it("does not log WARN again within the same hour for the same entry", async () => {
    const oldMs = Date.now() - 25 * 60 * 60 * 1000
    await writeEnvelopeFile(`${oldMs}-key-1.json`, envelope({ idempotency_key: "old-key-2", next_retry_at: new Date(Date.now() - 1000).toISOString() }))

    postQueuedToMesh.mockResolvedValue({ ok: false, status: 500, retryable: true })

    // First pass
    await processQueue()
    const warnCalls1 = consoleWarn.mock.calls.filter((call) => JSON.stringify(call).includes("QUEUE_OLD_ENTRY"))
    expect(warnCalls1.length).toBeGreaterThanOrEqual(1)

    // Second pass (same hour) - should not log again
    consoleWarn.mockClear()
    await processQueue()
    const warnCalls2 = consoleWarn.mock.calls.filter((call) => JSON.stringify(call).includes("QUEUE_OLD_ENTRY"))
    expect(warnCalls2.length).toBe(0)
  })

  it("moves corrupted queue files to corrupt/ with a warning", async () => {
    const fs = await import("fs/promises")
    const { join } = await import("path")
    await fs.writeFile(join(TEST_QUEUE_DIR, `${Date.now()}-corrupt.json`), "not-json", "utf-8")

    await processQueue()

    expect(await listQueueFiles()).toHaveLength(0)
    const corruptFiles = await fs.readdir(`${TEST_QUEUE_DIR}/corrupt`)
    expect(corruptFiles).toHaveLength(1)
    expect(consoleWarn).toHaveBeenCalled()
    const logged = JSON.stringify(consoleWarn.mock.calls)
    expect(logged).toContain("QUEUE_READ_FAILED")
  })

  it("keeps the ciphertext untouched across retries (the worker never decrypts)", async () => {
    const filepath = await writeEnvelopeFile(`${Date.now()}-key-1.json`, envelope({ ciphertext: "original-ciphertext" }))
    postQueuedToMesh.mockResolvedValue({ ok: false, status: 500, retryable: true })

    await processQueue()
    // simulate time passing: first retry is due after 30s, second after 60s more
    await processQueue(new Date(Date.now() + 31_000))
    await processQueue(new Date(Date.now() + 91_000))

    const updated = await readQueueEnvelope(filepath)
    expect(updated!.ciphertext).toBe("original-ciphertext")
    expect(updated!.retry_count).toBe(3)
    expect(postQueuedToMesh).toHaveBeenCalledTimes(3)
    expect(postQueuedToMesh).toHaveBeenNthCalledWith(3, "key-1", "original-ciphertext")
  })

  it("isPermanentFailure returns false for all inputs", () => {
    expect(isPermanentFailure()).toBe(false)
    expect(isPermanentFailure()).toBe(false)
    expect(isPermanentFailure()).toBe(false)
  })
})