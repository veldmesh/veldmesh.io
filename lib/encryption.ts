// Copyright (c) 2026 Ironfeast Media, LLC. All rights reserved.
import { createHash } from "crypto"
import { Encrypter, Decrypter } from "age-encryption"
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

function getDecryptionPrivateKey(): string {
  const key = process.env.QUEUE_DECRYPTION_KEY
  if (!key) {
    throw new Error("QUEUE_DECRYPTION_KEY environment variable is required (age private key starting with 'AGE-SECRET-KEY-1...')")
  }
  if (!key.startsWith("AGE-SECRET-KEY-1")) {
    throw new Error("QUEUE_DECRYPTION_KEY must be an age private key starting with 'AGE-SECRET-KEY-1'")
  }
  return key
}

function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64")
}

function fromBase64(str: string): Uint8Array {
  return new Uint8Array(Buffer.from(str, "base64"))
}

export async function encryptQueueEntry(data: object): Promise<string> {
  const encrypter = new Encrypter()
  encrypter.addRecipient(getEncryptionPublicKey())
  const plaintext = JSON.stringify(data)
  const ciphertext = await encrypter.encrypt(plaintext)
  return toBase64(ciphertext)
}

export async function decryptQueueEntry(ciphertextB64: string): Promise<object> {
  const decrypter = new Decrypter()
  decrypter.addIdentity(getDecryptionPrivateKey())
  const ciphertext = fromBase64(ciphertextB64)
  const plaintext = await decrypter.decrypt(ciphertext, "text")
  return JSON.parse(plaintext)
}

export function hashEmail(email: string): string {
  return createHash("sha256").update(email + getLogSalt()).digest("hex")
}

export function createConsentTextHash(label: string): string {
  return createHash("sha256").update(label.trim()).digest("hex")
}

export { CONSENT_LABEL, CONSENT_VERSION, MAX_SOURCE_LENGTH }
export const CONSENT_TEXT_HASH = createConsentTextHash(CONSENT_LABEL)