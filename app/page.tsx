// Copyright (c) 2026 Ironfeast Media, LLC. All rights reserved.
"use client"

import { useState, FormEvent, ChangeEvent } from "react"
import Link from "next/link"
import { ShieldCheck, DollarSign, Code2, Mail, Loader2, CheckCircle, AlertCircle } from "lucide-react"

const features = [
  {
    icon: DollarSign,
    title: "Per-network pricing",
    body: "A team of 3 running 20 servers pays $15/mo, not $45/mo.",
  },
  {
    icon: ShieldCheck,
    title: "Zero-trust by default",
    body: "All data-plane traffic is end-to-end encrypted with Noise IK. The coordination server holds public keys, VPN addresses, device names, advertised routes, and last-seen times on disk, keeps public endpoints (ip:port) in memory, and relays end-to-end-encrypted NAT signals it cannot read. It sees client IP addresses when devices connect, but never data-plane traffic.",
  },
  {
    icon: Code2,
    title: "Open source daemon",
    body: "MIT-licensed daemon and protocol. Audit the crypto. Self-host the coord server under BSL.",
  },
]

const CONSENT_LABEL = "I agree to receive updates from Veldmesh and understand I can unsubscribe at any time."

type FormStatus = "idle" | "submitting" | "success" | "error"

export default function HomePage() {
  const [email, setEmail] = useState("")
  const [consent, setConsent] = useState(false)
  const [status, setStatus] = useState<FormStatus>("idle")
  const [errorMessage, setErrorMessage] = useState("")
  const [source, setSource] = useState("")

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setStatus("submitting")
    setErrorMessage("")

    const utmParams = new URLSearchParams(window.location.search)
    const payload = {
      email,
      source,
      consent: true,
      utm_source: utmParams.get("utm_source") ?? undefined,
      utm_medium: utmParams.get("utm_medium") ?? undefined,
      utm_campaign: utmParams.get("utm_campaign") ?? undefined,
      utm_term: utmParams.get("utm_term") ?? undefined,
      utm_content: utmParams.get("utm_content") ?? undefined,
    }

    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (response.ok || response.status === 202) {
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

  const handleConsentChange = (e: ChangeEvent<HTMLInputElement>) => {
    setConsent(e.target.checked)
  }

  const handleSourceChange = (e: ChangeEvent<HTMLInputElement>) => {
    setSource(e.target.value)
  }

  return (
    <>
      {/* Hero */}
      <section className="bg-white py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-6xl">
            Your network, your rules.
            <br />
            <span className="text-green-600">Zero-trust mesh VPN</span> for teams and home labs.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600">
            One flat price per network — not per user. Connections are end-to-end encrypted
            between your devices. Most connect directly; when a network blocks that, traffic
            goes through a relay that cannot read it. The coordination server never carries
            traffic.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4 flex-wrap">
            <Link
              href="https://app.veldmesh.io/signup"
              className="rounded-md bg-green-600 px-6 py-3 text-base font-medium text-white hover:bg-green-700 transition-colors"
            >
              Get started free
            </Link>
            <Link
              href="/docs"
              className="rounded-md border border-slate-200 bg-white px-6 py-3 text-base font-medium text-slate-900 hover:bg-slate-50 transition-colors"
            >
              Read the docs
            </Link>
          </div>
        </div>
      </section>

      {/* Feature highlights */}
      <section className="bg-slate-50 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
            {features.map(({ icon: Icon, title, body }) => (
              <div key={title} className="rounded-xl bg-white p-8 shadow-sm border border-slate-100">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-50">
                  <Icon className="h-5 w-5 text-green-600" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-slate-900">{title}</h3>
                <p className="mt-2 text-slate-600">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Waitlist Signup */}
      <section className="bg-white py-20 border-t border-slate-200">
        <div className="mx-auto max-w-xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-slate-900">Join the waitlist</h2>
            <p className="mt-2 text-slate-600">
              Get early access to Veldmesh. We&apos;ll notify you when it&apos;s ready.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6" noValidate>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-2">
                Email address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" aria-hidden="true" />
                <input
                  type="email"
                  id="email"
                  name="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={handleEmailChange}
                  disabled={status === "submitting" || status === "success"}
                  placeholder="you@example.com"
                  className={`w-full pl-10 pr-4 py-3 rounded-md border text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-colors ${
                    status === "error" ? "border-red-500" : "border-slate-300 hover:border-slate-400"
                  }`}
                  aria-invalid={status === "error"}
                  aria-describedby={status === "error" ? "email-error" : undefined}
                />
              </div>
              {status === "error" && (
                <p id="email-error" className="mt-2 text-sm text-red-600 flex items-center gap-1" role="alert">
                  <AlertCircle className="h-4 w-4" aria-hidden="true" />
                  {errorMessage}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="source" className="block text-sm font-medium text-slate-700 mb-2">
                How did you hear about us? (optional)
              </label>
              <input
                type="text"
                id="source"
                name="source"
                value={source}
                onChange={handleSourceChange}
                disabled={status === "submitting" || status === "success"}
                placeholder="e.g., Twitter, Hacker News, colleague"
                className="w-full px-4 py-3 rounded-md border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-colors"
              />
            </div>

            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="consent"
                name="consent"
                required
                checked={consent}
                onChange={handleConsentChange}
                disabled={status === "submitting" || status === "success"}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-green-600 focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                aria-describedby="consent-text"
              />
              <label htmlFor="consent" id="consent-text" className="text-sm text-slate-600 cursor-pointer">
                {CONSENT_LABEL}
              </label>
            </div>

            <button
              type="submit"
              disabled={status === "submitting" || status === "success" || !email || !consent}
              className="w-full rounded-md bg-green-600 px-6 py-3 text-base font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {status === "submitting" && <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />}
              {status === "success" ? (
                <>
                  <CheckCircle className="h-5 w-5" aria-hidden="true" />
                  You&apos;re on the list!
                </>
              ) : (
                "Join waitlist"
              )}
            </button>

            {status === "success" && (
              <p className="text-center text-sm text-green-600 flex items-center justify-center gap-1">
                <CheckCircle className="h-4 w-4" aria-hidden="true" />
                Thanks for signing up! We&apos;ll be in touch soon.
              </p>
            )}
          </form>
        </div>
      </section>

      {/* Quick start */}
      <section className="bg-white py-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-slate-900">Up in three commands</h2>
          <div className="mt-8 rounded-xl bg-slate-900 p-6 text-left">
            <pre className="overflow-x-auto text-sm text-green-400 font-mono leading-relaxed">
              {`# Install
curl -fsSL https://get.veldmesh.io/install.sh | sh

# Authenticate
veld login

# Join your network
veld up --network my-homelab`}
            </pre>
          </div>
          <p className="mt-6 text-slate-600">
            Need to self-host?{" "}
            <Link href="/docs#self-hosting" className="text-green-600 hover:underline">
              Run your own coord server
            </Link>{" "}
            under BSL.
          </p>
        </div>
      </section>
    </>
  )
}