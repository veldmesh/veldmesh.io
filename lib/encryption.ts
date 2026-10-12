// Copyright (c) 2026 Ironfeast Media, LLC. All rights reserved.
//
// The web server holds ONLY the age public key (QUEUE_ENCRYPTION_KEY). Queue
// entries are encrypted with it; they can only be decrypted by the
// operator's server, which holds the matching private key. There is
// deliberately no decryption function and no private-key env var on this
// host: a compromise of the web server must not expose queued signups.
import { createHash } from "crypto"
import { Encrypter } from "age-encryption"
import { CONSENT_LABEL, CONSENT_VERSION, MAX_SOURCE_LENGTH } from "./constants"

function getLogSalt(): string {
  const salt = process.env.LOG_SALT
  if (!salt) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("LOG_SALT environment variable is required in production")
    }
    console.warn("WARNING: LOG_SALT not set, using insecure default. Set LOG_SALT in production!")
    return "default-salt-change-in-production"
  }
  return salt
}

function getEncryptionPublicKey(): string {
  const key = process.env.QUEUE_ENCRYPTION_KEY
  if (!key) {
    throw new Error("QUEUE_ENCRYPTION_KEY environment variable is required (age public key starting with 'age1...')")
  }
  if (!key.startsWith("age1")) {
    throw new Error("QUEUE_ENCRYPTION_KEY must be an age public key starting with 'age1'")
  }
  return key
}

function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64")
}

/**
 * Encrypt a queue payload with the age public key. Returns base64 ciphertext
 * that only the operator's server (holder of the private key) can decrypt.
 */
export async function encryptQueueEntry(data: object): Promise<string> {
  const encrypter = new Encrypter()
  encrypter.addRecipient(getEncryptionPublicKey())
  const plaintext = JSON.stringify(data)
  const ciphertext = await encrypter.encrypt(plaintext)
  return toBase64(ciphertext)
}

/** SHA-256 of email+salt — the only form in which an email may appear in logs. */
export function hashEmail(email: string): string {
  return createHash("sha256").update(email + getLogSalt()).digest("hex")
}

export function createConsentTextHash(label: string): string {
  return createHash("sha256").update(label.trim()).digest("hex")
}

export { CONSENT_LABEL, CONSENT_VERSION, MAX_SOURCE_LENGTH }
export const CONSENT_TEXT_HASH = createConsentTextHash(CONSENT_LABEL)
