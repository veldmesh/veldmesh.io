// Copyright (c) 2026 Ironfeast Media, LLC. All rights reserved.
import { describe, it, expect, beforeAll, vi } from "vitest"

// Test age key pair (generated for testing only)
// Public key: age1qhps403l6r56efhkfefu9pxmzyn96ea8c0m9pn3khm3m5cjdhg3spg730h
// Private key: AGE-SECRET-KEY-1D4SNGZQY8S3MAQWHUGMHZ6CXS2QNCT08X8CRPSH67N7S3GNLCRKSA8QYDG
process.env.QUEUE_ENCRYPTION_KEY = "age1qhps403l6r56efhkfefu9pxmzyn96ea8c0m9pn3khm3m5cjdhg3spg730h"
process.env.QUEUE_DECRYPTION_KEY = "AGE-SECRET-KEY-1D4SNGZQY8S3MAQWHUGMHZ6CXS2QNCT08X8CRPSH67N7S3GNLCRKSA8QYDG"
process.env.LOG_SALT = "test-salt"

let encryptQueueEntry: typeof import("@/lib/encryption").encryptQueueEntry
let decryptQueueEntry: typeof import("@/lib/encryption").decryptQueueEntry
let hashEmail: typeof import("@/lib/encryption").hashEmail
let createConsentTextHash: typeof import("@/lib/encryption").createConsentTextHash

beforeAll(async () => {
  const mod = await import("@/lib/encryption")
  encryptQueueEntry = mod.encryptQueueEntry
  decryptQueueEntry = mod.decryptQueueEntry
  hashEmail = mod.hashEmail
  createConsentTextHash = mod.createConsentTextHash
})

describe("encryption", () => {
  it("encrypts and decrypts queue entries", async () => {
    const data = { email: "test@example.com", foo: "bar", count: 42 }
    const encrypted = await encryptQueueEntry(data)
    const decrypted = await decryptQueueEntry(encrypted)

    expect(decrypted).toEqual(data)
  })

  it("produces different ciphertext for same plaintext", async () => {
    const data = { email: "test@example.com" }
    const encrypted1 = await encryptQueueEntry(data)
    const encrypted2 = await encryptQueueEntry(data)

    expect(encrypted1).not.toBe(encrypted2)
    expect(await decryptQueueEntry(encrypted1)).toEqual(data)
    expect(await decryptQueueEntry(encrypted2)).toEqual(data)
  })

  it("hashEmail produces consistent hashes with salt", () => {
    const hash1 = hashEmail("test@example.com")
    const hash2 = hashEmail("test@example.com")
    const hash3 = hashEmail("other@example.com")

    expect(hash1).toBe(hash2)
    expect(hash1).not.toBe(hash3)
    expect(hash1).toHaveLength(64)
  })

  it("createConsentTextHash produces consistent SHA-256 hashes", () => {
    const label = "I agree to receive updates"
    const hash1 = createConsentTextHash(label)
    const hash2 = createConsentTextHash(label)
    const hash3 = createConsentTextHash("different label")

    expect(hash1).toBe(hash2)
    expect(hash1).not.toBe(hash3)
    expect(hash1).toHaveLength(64)
  })

  it("hashEmail is case sensitive for local part but domain is lowercased in practice", () => {
    // The hash is of the exact email + salt, so case matters
    const hash1 = hashEmail("Test@Example.com")
    const hash2 = hashEmail("test@example.com")
    expect(hash1).not.toBe(hash2)
  })

  it("throws if LOG_SALT not set in production", async () => {
    const originalEnv = process.env.NODE_ENV
    const originalSalt = process.env.LOG_SALT
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("LOG_SALT", "")

    await expect(async () => {
      const mod = await import("@/lib/encryption")
      mod.hashEmail("test@example.com")
    }).rejects.toThrow("LOG_SALT environment variable is required in production")

    vi.stubEnv("NODE_ENV", originalEnv)
    if (originalSalt) vi.stubEnv("LOG_SALT", originalSalt)
  })

  it("throws if QUEUE_ENCRYPTION_KEY not set", async () => {
    const originalKey = process.env.QUEUE_ENCRYPTION_KEY
    vi.stubEnv("QUEUE_ENCRYPTION_KEY", "")

    await expect(async () => {
      const mod = await import("@/lib/encryption")
      await mod.encryptQueueEntry({ test: "data" })
    }).rejects.toThrow("QUEUE_ENCRYPTION_KEY environment variable is required")

    vi.stubEnv("QUEUE_ENCRYPTION_KEY", originalKey)
  })

  it("throws if QUEUE_DECRYPTION_KEY not set", async () => {
    const originalKey = process.env.QUEUE_DECRYPTION_KEY
    vi.stubEnv("QUEUE_DECRYPTION_KEY", "")

    await expect(async () => {
      const mod = await import("@/lib/encryption")
      await mod.decryptQueueEntry("invalid")
    }).rejects.toThrow("QUEUE_DECRYPTION_KEY environment variable is required")

    vi.stubEnv("QUEUE_DECRYPTION_KEY", originalKey)
  })

  it("throws if QUEUE_ENCRYPTION_KEY is not a valid age public key", async () => {
    const originalKey = process.env.QUEUE_ENCRYPTION_KEY
    vi.stubEnv("QUEUE_ENCRYPTION_KEY", "invalid-key")

    await expect(async () => {
      const mod = await import("@/lib/encryption")
      await mod.encryptQueueEntry({ test: "data" })
    }).rejects.toThrow("must be an age public key starting with 'age1'")

    vi.stubEnv("QUEUE_ENCRYPTION_KEY", originalKey)
  })

  it("throws if QUEUE_DECRYPTION_KEY is not a valid age private key", async () => {
    const originalKey = process.env.QUEUE_DECRYPTION_KEY
    vi.stubEnv("QUEUE_DECRYPTION_KEY", "invalid-key")

    await expect(async () => {
      const mod = await import("@/lib/encryption")
      await mod.decryptQueueEntry("invalid")
    }).rejects.toThrow("must be an age private key starting with 'AGE-SECRET-KEY-1'")

    vi.stubEnv("QUEUE_DECRYPTION_KEY", originalKey)
  })
})