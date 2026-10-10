// Copyright (c) 2026 Ironfeast Media, LLC. All rights reserved.
"use client"

import { useId, useState } from "react"
import Link from "next/link"
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react"
import { HONEYPOT_FIELD } from "@/lib/waitlist/validation"

type FormStatus = "idle" | "submitting" | "success" | "error"

const FALLBACK_ERROR = "Something went wrong. Please try again in a moment."

export function WaitlistForm({ buttonLabel = "Join the waitlist" }: { buttonLabel?: string }) {
  const emailId = useId()
  const consentId = useId()
  const honeypotId = useId()
  const [status, setStatus] = useState<FormStatus>("idle")
  const [message, setMessage] = useState("")

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (status === "submitting") return

    const data = new FormData(event.currentTarget)
    const params = new URLSearchParams(window.location.search)

    setStatus("submitting")
    setMessage("")

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: data.get("email"),
          consent: data.get("consent") === "on",
          [HONEYPOT_FIELD]: data.get(HONEYPOT_FIELD) ?? "",
          utm_source: params.get("utm_source") ?? "",
          utm_medium: params.get("utm_medium") ?? "",
          utm_campaign: params.get("utm_campaign") ?? "",
          referrer: document.referrer,
        }),
      })

      const body = (await res.json().catch(() => null)) as
        | { ok?: boolean; message?: string; error?: string }
        | null

      if (res.ok && body?.ok) {
        setStatus("success")
        setMessage(body.message ?? "You're on the list.")
      } else {
        setStatus("error")
        setMessage(body?.error ?? FALLBACK_ERROR)
      }
    } catch {
      setStatus("error")
      setMessage(FALLBACK_ERROR)
    }
  }

  if (status === "success") {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex items-center justify-center gap-2 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-800"
      >
        <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-green-600" />
        {message}
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="text-left">
      <div className="flex flex-col gap-3 sm:flex-row">
        <label htmlFor={emailId} className="sr-only">
          Email address
        </label>
        <input
          id={emailId}
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          className="w-full flex-1 rounded-md border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
        />
        <button
          type="submit"
          disabled={status === "submitting"}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-green-600 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status === "submitting" && <Loader2 className="h-4 w-4 animate-spin" />}
          {status === "submitting" ? "Joining…" : buttonLabel}
        </button>
      </div>

      <div className="mt-3 flex items-start gap-2">
        <input
          id={consentId}
          name="consent"
          type="checkbox"
          required
          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-green-600 focus:ring-green-500"
        />
        <label htmlFor={consentId} className="text-xs leading-relaxed text-slate-500">
          I agree to receive an email when my waitlist invitation is ready. See our{" "}
          <Link href="/privacy" className="text-green-600 hover:underline">
            privacy policy
          </Link>
          .
        </label>
      </div>

      <div hidden aria-hidden="true">
        <label htmlFor={honeypotId}>Company website</label>
        <input
          id={honeypotId}
          name={HONEYPOT_FIELD}
          type="text"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      {status === "error" && (
        <p
          role="alert"
          aria-live="polite"
          className="mt-3 flex items-start gap-2 text-sm text-red-600"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          {message}
        </p>
      )}
    </form>
  )
}
