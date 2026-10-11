// Copyright (c) 2026 Ironfeast Media, LLC. All rights reserved.
import { describe, it, expect } from "vitest"
import { validateEmail, normalizeEmail } from "@/lib/email"

describe("validateEmail", () => {
  it("accepts valid email addresses", () => {
    expect(validateEmail("user@example.com").valid).toBe(true)
    expect(validateEmail("test.email@domain.org").valid).toBe(true)
    expect(validateEmail("user+tag@example.co.uk").valid).toBe(true)
    expect(validateEmail("user123@test-domain.io").valid).toBe(true)
  })

  it("rejects invalid email formats", () => {
    expect(validateEmail("").valid).toBe(false)
    expect(validateEmail("not-an-email").valid).toBe(false)
    expect(validateEmail("@example.com").valid).toBe(false)
    expect(validateEmail("user@").valid).toBe(false)
    expect(validateEmail("user@.com").valid).toBe(false)
    expect(validateEmail("user @example.com").valid).toBe(false)
    expect(validateEmail("user@example").valid).toBe(false)
  })

  it("rejects disposable email domains", () => {
    expect(validateEmail("user@mailinator.com").valid).toBe(false)
    expect(validateEmail("test@10minutemail.com").valid).toBe(false)
    expect(validateEmail("foo@guerrillamail.com").valid).toBe(false)
    expect(validateEmail("bar@tempmail.org").valid).toBe(false)
    expect(validateEmail("baz@yopmail.com").valid).toBe(false)
  })

  it("is case insensitive for domain checking", () => {
    expect(validateEmail("user@MAILINATOR.COM").valid).toBe(false)
    expect(validateEmail("user@Mailinator.Com").valid).toBe(false)
  })

  it("returns appropriate error messages", () => {
    expect(validateEmail("").error).toBe("Email is required")
    expect(validateEmail("invalid").error).toBe("Invalid email format")
    expect(validateEmail("user@mailinator.com").error).toBe("Disposable email domains are not allowed")
  })
})

describe("normalizeEmail", () => {
  it("trims whitespace and lowercases", () => {
    expect(normalizeEmail("  User@Example.COM  ")).toBe("user@example.com")
    expect(normalizeEmail("TEST@DOMAIN.ORG")).toBe("test@domain.org")
  })
})