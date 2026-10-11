// Copyright (c) 2026 Ironfeast Media, LLC. All rights reserved.
import { describe, it, expect, beforeAll } from "vitest"

// Use a passphrase for testing (at least 8-10 random alphanumeric characters)
process.env.QUEUE_ENCRYPTION_KEY = "test-passphrase-12345"
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
})