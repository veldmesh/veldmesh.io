// Copyright (c) 2026 Ironfeast Media, LLC. All rights reserved.
import { createHash } from "crypto"
import { Encrypter, Decrypter } from "age-encryption"

const LOG_SALT = process.env.LOG_SALT ?? "default-salt-change-in-production"

function getEncryptionKey(): string {
  const key = process.env.QUEUE_ENCRYPTION_KEY
  if (!key) {
    throw new Error("QUEUE_ENCRYPTION_KEY environment variable is required")
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
  encrypter.setPassphrase(getEncryptionKey())
  const plaintext = JSON.stringify(data)
  const ciphertext = await encrypter.encrypt(plaintext)
  return toBase64(ciphertext)
}

export async function decryptQueueEntry(ciphertextB64: string): Promise<object> {
  const decrypter = new Decrypter()
  decrypter.addPassphrase(getEncryptionKey())
  const ciphertext = fromBase64(ciphertextB64)
  const plaintext = await decrypter.decrypt(ciphertext, "text")
  return JSON.parse(plaintext)
}

export function hashEmail(email: string): string {
  return createHash("sha256").update(email + LOG_SALT).digest("hex")
}

export function createConsentTextHash(label: string): string {
  return createHash("sha256").update(label.trim()).digest("hex")
}