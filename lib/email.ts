// Copyright (c) 2026 Ironfeast Media, LLC. All rights reserved.
import disposableDomains from "@/data/disposable-domains.json"

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const disposableDomainSet = new Set(disposableDomains as string[])

export function validateEmail(email: string): { valid: boolean; error?: string } {
  if (!email || typeof email !== "string") {
    return { valid: false, error: "Email is required" }
  }

  const trimmed = email.trim().toLowerCase()

  if (!EMAIL_REGEX.test(trimmed)) {
    return { valid: false, error: "Invalid email format" }
  }

  const domain = trimmed.split("@")[1]
  if (disposableDomainSet.has(domain)) {
    return { valid: false, error: "Disposable email domains are not allowed" }
  }

  return { valid: true }
}

export function normalizeEmail(email: string): string {
  if (!email) return ""
  return email.trim().toLowerCase()
}