// Copyright (c) 2026 Ironfeast Media, LLC. All rights reserved.
import type { Metadata } from "next"
import Link from "next/link"
import { WaitlistForm } from "@/components/waitlist-form"

export const metadata: Metadata = {
  title: "Join the waitlist — Veldmesh",
  description:
    "Leave your email and we'll send you an invitation when a spot opens up. No spam — just your invitation.",
}

export default function WaitlistPage() {
  return (
    <div className="bg-white py-20">
      <div className="mx-auto max-w-xl px-4 text-center sm:px-6 lg:px-8">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900">Join the waitlist</h1>
        <p className="mx-auto mt-4 max-w-md text-lg text-slate-600">
          Leave your email and we&rsquo;ll send you an invitation when a spot opens up. That&rsquo;s
          the only email this form will ever send you.
        </p>

        <div className="mx-auto mt-10 max-w-md">
          <WaitlistForm />
        </div>

        <p className="mx-auto mt-8 max-w-md text-sm leading-relaxed text-slate-500">
          We collect your email address, the time you joined, and which page or campaign brought
          you here — nothing else. To be removed from the waitlist, email{" "}
          <a href="mailto:hello@veldmesh.io" className="text-green-600 hover:underline">
            hello@veldmesh.io
          </a>
          . Details in the{" "}
          <Link href="/privacy" className="text-green-600 hover:underline">
            privacy policy
          </Link>
          .
        </p>
      </div>
    </div>
  )
}
