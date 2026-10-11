// Copyright (c) 2026 Ironfeast Media, LLC. All rights reserved.
import Link from "next/link"
import { ShieldCheck, DollarSign, Code2 } from "lucide-react"
import { WaitlistForm } from "@/components/waitlist-form"

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

export default function HomePage() {
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
          <div className="mx-auto mt-10 max-w-md">
            <WaitlistForm />
          </div>
          <p className="mt-6 text-sm text-slate-500">
            Want to read first?{" "}
            <Link href="/docs" className="font-medium text-green-600 hover:underline">
              Read the docs
            </Link>
          </p>
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
