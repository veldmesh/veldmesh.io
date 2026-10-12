// Copyright (c) 2026 Ironfeast Media, LLC. All rights reserved.
"use client"

import { useId, useState, type ChangeEvent, type FormEvent } from "react"
import { Loader2, CheckCircle, AlertCircle } from "lucide-react"
import { CONSENT_LABEL, HONEYPOT_FIELD } from "@/lib/constants"

type FormStatus = "idle" | "submitting" | "success" | "error"

interface WaitlistFormProps {
  /** Page name sent as `source` when the visitor doesn't type one (e.g. "home"). */
  pageSource: string
}

export function WaitlistForm({ pageSource }: WaitlistFormProps) {
  const emailId = useId()
  const sourceId = useId()
  const consentId = useId()
  const honeypotId = useId()
  const [email, setEmail] = useState("")
  const [source, setSource] = useState("")
  const [consent, setConsent] = useState(false)
  const [status, setStatus] = useState<FormStatus>("idle")
  const [errorMessage, setErrorMessage] = useState("")

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (status === "submitting") return
    setStatus("submitting")
    setErrorMessage("")

    const params = new URLSearchParams(window.location.search)
    const payload = {
      email,
      consent,
      source: source.trim().length > 0 ? source.trim() : pageSource,
      [HONEYPOT_FIELD]: (document.getElementById(honeypotId) as HTMLInputElement | null)?.value ?? "",
      utm_source: params.get("utm_source") ?? undefined,
      utm_medium: params.get("utm_medium") ?? undefined,
      utm_campaign: params.get("utm_campaign") ?? undefined,
      utm_term: params.get("utm_term") ?? undefined,
      utm_content: params.get("utm_content") ?? undefined,
      referrer: document.referrer || undefined,
    }

    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const data = (await response.json().catch(() => ({}))) as { success?: boolean; error?: string }

      if (response.ok) {
        setStatus("success")
        setEmail("")
        setConsent(false)
      } else {
        setStatus("error")
        setErrorMessage(data.error ?? "Something went wrong. Please try again.")
      }
    } catch {
      setStatus("error")
      setErrorMessage("Network error. Please check your connection and try again.")
    }
  }

  const handleEmailChange = (e: ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value)
    if (status === "error") setStatus("idle")
  }

  if (status === "success") {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex items-center justify-center gap-2 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-800"
      >
        <CheckCircle className="h-5 w-5 flex-shrink-0 text-green-600" aria-hidden="true" />
        You're on the list! We'll be in touch soon.
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 text-left" noValidate>
      <div>
        <label htmlFor={emailId} className="mb-2 block text-sm font-medium text-slate-700">
          Email address
        </label>
        <input
          type="email"
          id={emailId}
          name="email"
          autoComplete="email"
          required
          value={email}
          onChange={handleEmailChange}
          disabled={status === "submitting"}
          placeholder="you@example.com"
          className={`w-full rounded-md border px-4 py-3 text-slate-900 placeholder-slate-400 transition-colors focus:border-transparent focus:outline-none focus:ring-2 focus:ring-green-500 ${
            status === "error" ? "border-red-500" : "border-slate-300 hover:border-slate-400"
          }`}
          aria-invalid={status === "error"}
          aria-describedby={status === "error" ? "waitlist-error" : undefined}
        />
      </div>

      <div>
        <label htmlFor={sourceId} className="mb-2 block text-sm font-medium text-slate-700">
          How did you hear about us? (optional)
        </label>
        <input
          type="text"
          id={sourceId}
          name="source"
          value={source}
          onChange={(e) => setSource(e.target.value)}
          disabled={status === "submitting"}
          placeholder="e.g., Twitter, Hacker News, colleague"
          className="w-full rounded-md border border-slate-300 px-4 py-3 text-slate-900 placeholder-slate-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>

      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          id={consentId}
          name="consent"
          required
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          disabled={status === "submitting"}
          className="mt-1 h-4 w-4 rounded border-slate-300 text-green-600 focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
        />
        <label htmlFor={consentId} className="cursor-pointer text-sm text-slate-600">
          {CONSENT_LABEL}
        </label>
      </div>

      {/* Honeypot: hidden from humans, bots fill it and the signup is dropped server-side. */}
      <div hidden aria-hidden="true">
        <label htmlFor={honeypotId}>Company website</label>
        <input id={honeypotId} name={HONEYPOT_FIELD} type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <button
        type="submit"
        disabled={status === "submitting" || !email || !consent}
        className="flex w-full items-center justify-center gap-2 rounded-md bg-green-600 px-6 py-3 text-base font-medium text-white transition-colors hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {status === "submitting" && <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />}
        Join waitlist
      </button>

      {status === "error" && (
        <p id="waitlist-error" role="alert" aria-live="polite" className="flex items-start gap-1 text-sm text-red-600">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
          {errorMessage}
        </p>
      )}
    </form>
  )
}
