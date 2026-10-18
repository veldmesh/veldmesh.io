// Copyright (c) 2026 Ironfeast Media, LLC. All rights reserved.
import { describe, it, expect, beforeEach, afterEach, vi, beforeAll } from "vitest"

vi.mock("@/lib/queue-worker", () => {
  const processQueue = vi.fn()
  return { processQueue }
})

vi.mock("@/lib/rate-limit", () => ({
  startRateLimitCleanup: vi.fn(),
  stopRateLimitCleanup: vi.fn(),
  waitlistRateLimiter: { check: vi.fn(), clear: vi.fn() },
}))

vi.mock("@/lib/logging", () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
}))

let startWorker: typeof import("@/scripts/waitlist-worker").startWorker
let stopWorker: typeof import("@/scripts/waitlist-worker").stopWorker
let resetWorkerState: typeof import("@/scripts/waitlist-worker").resetWorkerState
let processQueue: ReturnType<typeof vi.fn>

beforeAll(async () => {
  process.env.WAITLIST_ENABLED = "true"
  process.env.WAITLIST_FORWARD_URL = "https://example.com"
  process.env.WAITLIST_BEARER_TOKEN = "test-token"
  process.env.QUEUE_ENCRYPTION_KEY = "age1test"
  process.env.LOG_SALT = "test-salt"

  const workerMod = await import("@/scripts/waitlist-worker")
  const queueWorkerMod = await import("@/lib/queue-worker")
  startWorker = workerMod.startWorker
  stopWorker = workerMod.stopWorker
  resetWorkerState = workerMod.resetWorkerState
  processQueue = queueWorkerMod.processQueue as unknown as ReturnType<typeof vi.fn>
})

describe("worker scheduling with fake timers", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    processQueue.mockReset()
    processQueue.mockResolvedValue(undefined)
    resetWorkerState()
  })

  afterEach(async () => {
    await stopWorker()
    vi.useRealTimers()
  })

  it("schedules the next run 30s after the previous one finishes (no overlap, no drift)", async () => {
    startWorker()
    expect(processQueue).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(30_000)
    expect(processQueue).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(30_000)
    expect(processQueue).toHaveBeenCalledTimes(3)
  })

  it("stopWorker waits for the in-flight run to finish", async () => {
    let resolveRun: () => void
    processQueue.mockImplementation(() => new Promise<void>((resolve) => { resolveRun = resolve }))
    startWorker()
    expect(processQueue).toHaveBeenCalledTimes(1)
    const stopPromise = stopWorker()
    resolveRun!()
    await vi.advanceTimersByTimeAsync(0)
    await stopPromise
  })
})
