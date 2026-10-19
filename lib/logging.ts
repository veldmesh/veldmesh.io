// Copyright (c) 2026 Ironfeast Media, LLC. All rights reserved.
import { hashEmail } from "./encryption"

export type LogLevel = "info" | "warn" | "error"

export interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  email_hash?: string
  consent_at?: string
  error_code?: string
  metadata?: Record<string, unknown>
}

const SENSITIVE_KEYS = new Set(["email", "referrer", "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"])

function sanitizeMetadata(metadata?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!metadata) return undefined
  const sanitized: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(metadata)) {
    if (!SENSITIVE_KEYS.has(key)) {
      sanitized[key] = value
    }
  }
  return Object.keys(sanitized).length > 0 ? sanitized : undefined
}

function formatLog(entry: LogEntry): string {
  const { email_hash, consent_at, error_code, metadata, ...rest } = entry
  const safeMetadata = sanitizeMetadata(metadata)
  return JSON.stringify({ ...rest, email_hash, consent_at, error_code, metadata: safeMetadata })
}

export function logInfo(message: string, email?: string, consent_at?: string, metadata?: Record<string, unknown>): void {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level: "info",
    message,
    email_hash: email ? hashEmail(email) : undefined,
    consent_at,
    metadata,
  }
  console.log(formatLog(entry))
}

export function logWarn(message: string, email?: string, consent_at?: string, error_code?: string, metadata?: Record<string, unknown>): void {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level: "warn",
    message,
    email_hash: email ? hashEmail(email) : undefined,
    consent_at,
    error_code,
    metadata,
  }
  console.warn(formatLog(entry))
}

export function logError(message: string, email?: string, consent_at?: string, error_code?: string, metadata?: Record<string, unknown>): void {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level: "error",
    message,
    email_hash: email ? hashEmail(email) : undefined,
    consent_at,
    error_code,
    metadata,
  }
  console.error(formatLog(entry))
}
