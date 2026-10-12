// Copyright (c) 2026 Ironfeast Media, LLC. All rights reserved.
import { describe, it, expect, beforeEach, afterEach, vi, beforeAll } from "vitest"

process.env.QUEUE_ENCRYPTION_KEY = "age1qhps403l6r56efhkfefu9pxmzyn96ea8c0m9pn3khm3m5cjdhg3spg730h"
process.env.LOG_SALT = "test-salt"
process.env.WAITLIST_QUEUE_DIR = "/tmp/veldsite-test-waitlist-queue-worker-test"

const TEST_QUEUE_DIR = process.env.WAITLIST_QUEUE_DIR

vi.mock("@/lib/mesh", () => ({
  postQueuedToMesh: vi.fn(),
}))

let processQueue: typeof import("@/lib/queue-worker").processQueue
let listQueueFiles: typeof import("@/lib/queue-worker").listQueueFiles
let readQueueEnvelope: typeof import("@/lib/queue-worker").readQueueEnvelope
let postQueuedToMesh: ReturnType<typeof vi.fn>

beforeAll(async () => {
  const queueWorkerMod = await import("@/lib/queue-worker")
  const meshMod = await import("@/lib/mesh")
  processQueue = queueWorkerMod.processQueue
  listQueueFiles = queueWorkerMod.listQueueFiles
  readQueueEnvelope = queueWorkerMod.readQueueEnvelope
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
    postQueuedToMesh.mockReset()
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

  it("removes permanently rejected entries and logs at ERROR with the idempotency_key", async () => {
    await writeEnvelopeFile(`${Date.now()}-key-1.json`, envelope())
    postQueuedToMesh.mockResolvedValue({ ok: false, status: 400, retryable: false })

    await processQueue()

    expect(await listQueueFiles()).toHaveLength(0)
    expect(consoleError).toHaveBeenCalled()
    const logged = JSON.stringify(consoleError.mock.calls)
    expect(logged).toContain("key-1")
    expect(logged).toContain("MESH_PERMANENT_400")
  })

  it("expires entries after 24h: logs at ERROR with the idempotency_key, never silently drops", async () => {
    const oldMs = Date.now() - 25 * 60 * 60 * 1000
    await writeEnvelopeFile(`${oldMs}-key-1.json`, envelope())

    await processQueue()

    expect(postQueuedToMesh).not.toHaveBeenCalled()
    expect(await listQueueFiles()).toHaveLength(0)
    expect(consoleError).toHaveBeenCalled()
    const logged = JSON.stringify(consoleError.mock.calls)
    expect(logged).toContain("key-1")
    expect(logged).toContain("QUEUE_EXPIRED")
  })

  it("deletes corrupted queue files with a warning", async () => {
    const fs = await import("fs/promises")
    const { join } = await import("path")
    await fs.writeFile(join(TEST_QUEUE_DIR, `${Date.now()}-corrupt.json`), "not-json", "utf-8")

    await processQueue()

    expect(await listQueueFiles()).toHaveLength(0)
    expect(consoleWarn).toHaveBeenCalled()
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
})
