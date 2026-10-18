// Copyright (c) 2026 Ironfeast Media, LLC. All rights reserved.
import { describe, it, expect, beforeAll, vi } from "vitest"
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
})

let encryptQueueEntry: typeof import("@/lib/encryption").encryptQueueEntry
let hashEmail: typeof import("@/lib/encryption").hashEmail
let createConsentTextHash: typeof import("@/lib/encryption").createConsentTextHash
let CONSENT_TEXT_HASH: typeof import("@/lib/encryption").CONSENT_TEXT_HASH

beforeAll(async () => {
  const mod = await import("@/lib/encryption")
  encryptQueueEntry = mod.encryptQueueEntry
  hashEmail = mod.hashEmail
  createConsentTextHash = mod.createConsentTextHash
  CONSENT_TEXT_HASH = mod.CONSENT_TEXT_HASH
})

describe("encryption", () => {
  it("produces base64 ciphertext that is not valid JSON", async () => {
    const encrypted = await encryptQueueEntry({ email: "test@example.com", foo: "bar" })

    expect(() => JSON.parse(encrypted)).toThrow()
    const decoded = Buffer.from(encrypted, "base64").toString("utf-8")
    expect(decoded).toContain("age-encryption.org")
  })

  it("ciphertext does not contain the plaintext payload", async () => {
    const encrypted = await encryptQueueEntry({ email: "secret-value@example.com" })

    expect(encrypted).not.toContain("secret-value")
    const decoded = Buffer.from(encrypted, "base64").toString("utf-8")
    expect(decoded).not.toContain("secret-value")
  })

  it("produces different ciphertext for the same plaintext", async () => {
    const data = { email: "test@example.com" }
    const encrypted1 = await encryptQueueEntry(data)
    const encrypted2 = await encryptQueueEntry(data)

    expect(encrypted1).not.toBe(encrypted2)
  })

  it("ciphertext is recoverable with the matching private key (held by the operator's server)", async () => {
    const data = { email: "test@example.com", source: "home", consent_at: "2026-01-01T00:00:00.000Z" }
    const encrypted = await encryptQueueEntry(data)

    const decrypter = new Decrypter()
    decrypter.addIdentity(TEST_PRIVATE_KEY)
    const plaintext = await decrypter.decrypt(new Uint8Array(Buffer.from(encrypted, "base64")), "text")
    expect(JSON.parse(plaintext)).toEqual(data)
  })

  it("the site exports no decryption function — it must not be able to read the queue", async () => {
    const mod = await import("@/lib/encryption")
    const exports = Object.keys(mod)
    expect(exports).not.toContain("decryptQueueEntry")
    expect(exports.find((name) => name.toLowerCase().includes("decrypt"))).toBeUndefined()
  })

  it("hashEmail produces consistent salted hashes", () => {
    const hash1 = hashEmail("test@example.com")
    const hash2 = hashEmail("test@example.com")
    const hash3 = hashEmail("other@example.com")

    expect(hash1).toBe(hash2)
    expect(hash1).not.toBe(hash3)
    expect(hash1).toHaveLength(64)
  })

  it("createConsentTextHash produces consistent SHA-256 hashes", () => {
    const label = "I agree to receive updates"
    expect(createConsentTextHash(label)).toBe(createConsentTextHash(label))
    expect(createConsentTextHash(label)).not.toBe(createConsentTextHash("different label"))
    expect(createConsentTextHash(label)).toHaveLength(64)
  })

  it("CONSENT_TEXT_HASH matches the consent label from constants", async () => {
    const { CONSENT_LABEL } = await import("@/lib/constants")
    expect(CONSENT_TEXT_HASH).toBe(createConsentTextHash(CONSENT_LABEL))
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

  it("throws if QUEUE_ENCRYPTION_KEY is not a valid age public key", async () => {
    const originalKey = process.env.QUEUE_ENCRYPTION_KEY
    vi.stubEnv("QUEUE_ENCRYPTION_KEY", "invalid-key")

    await expect(async () => {
      const mod = await import("@/lib/encryption")
      await mod.encryptQueueEntry({ test: "data" })
    }).rejects.toThrow("must be an age public key starting with 'age1'")

    vi.stubEnv("QUEUE_ENCRYPTION_KEY", originalKey)
  })
})

describe("consent hash consistency", () => {
  it("createConsentTextHash(displayed label) === CONSENT_TEXT_HASH", async () => {
    const { CONSENT_LABEL } = await import("@/lib/constants")
    const { createConsentTextHash, CONSENT_TEXT_HASH } = await import("@/lib/encryption")

    // The label as displayed in the form (from CONSENT_LABEL constant)
    const displayedLabel = CONSENT_LABEL

    // The hash computed from the displayed label should match the precomputed constant
    expect(createConsentTextHash(displayedLabel)).toBe(CONSENT_TEXT_HASH)

    // If someone changes the label but forgets to update CONSENT_LABEL constant,
    // this test would fail because the displayed text wouldn't match
    expect(createConsentTextHash("I agree to receive updates from Veldmesh and understand I can unsubscribe at any time.")).toBe(CONSENT_TEXT_HASH)
  })
})
