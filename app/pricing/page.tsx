// Copyright (c) 2026 Ironfeast Media, LLC. All rights reserved.
import type { Metadata } from "next"
import Link from "next/link"
import { Check } from "lucide-react"

export const metadata: Metadata = {
  title: "Pricing — Veld",
}

const tiers = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    target: "Home lab",
    machines: "5 machines / network",
    networks: "1 network",
    subnetRouting: false,
    extras: [],
    highlighted: false,
  },
  {
    name: "Plus",
    price: "$6",
    period: "/ month",
    target: "Power users",
    machines: "15 machines / network",
    networks: "5 networks",
    subnetRouting: false,
    extras: [],
    highlighted: false,
  },
  {
    name: "Teams",
    price: "$15",
    period: "/ month",
    target: "Small businesses",
    machines: "50 machines / network",
    networks: "Unlimited networks",
    subnetRouting: true,
    extras: [],
    highlighted: true,
  },
  {
    name: "Business",
    price: "$49",
    period: "/ month",
    target: "Companies",
    machines: "Unlimited machines",
    networks: "Unlimited networks",
    subnetRouting: true,
    extras: ["Audit logs", "SSO / SAML — managed tier only (not in Community Edition)"],
    highlighted: false,
  },
]

const faq = [
  {
    q: "Can I self-host the coord server?",
    a: "Yes. The CE coordination server is released under BSL, which automatically converts to Apache 2.0 four years after each release. Self-hosting gives you the Free tier feature set with your own infrastructure.",
  },
  {
    q: "What happens if I exceed machine limits?",
    a: "New machines cannot join the network until you upgrade your plan or remove existing machines. Existing connected machines are not kicked — only new join attempts are blocked.",
  },
  {
    q: "Is the daemon open source?",
    a: "Yes. The daemon and wire protocol are MIT licensed. You can read the source, audit the Noise IK implementation, fork it, and embed it in your own products.",
  },
]

export default function PricingPage() {
  return (
    <div className="bg-white py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-6">
          <h1 className="text-4xl font-bold text-slate-900">Simple, transparent pricing</h1>
          <p className="mt-4 text-lg text-slate-600">
            Pay per network, not per user. A team of 20 costs the same as a team of 3.
          </p>
        </div>

        <div className="mx-auto mb-10 max-w-xl rounded-xl border border-green-200 bg-green-50 px-6 py-4 text-center">
          <p className="text-sm font-medium text-green-800">
            Per-network pricing — not per-user. Scale your team without scaling your bill.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={`relative rounded-2xl border p-8 flex flex-col ${
                tier.highlighted
                  ? "border-green-500 shadow-lg ring-1 ring-green-500"
                  : "border-slate-200"
              }`}
            >
              {tier.highlighted && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-green-600 px-3 py-0.5 text-xs font-medium text-white">
                  Recommended
                </span>
              )}
              <div>
                <h2 className="text-lg font-semibold text-slate-900">{tier.name}</h2>
                <p className="text-xs text-slate-500 mt-0.5">{tier.target}</p>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-slate-900">{tier.price}</span>
                  <span className="text-sm text-slate-500">{tier.period}</span>
                </div>
              </div>

              <ul className="mt-6 space-y-3 flex-1">
                <li className="flex items-start gap-2 text-sm text-slate-700">
                  <Check className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                  {tier.machines}
                </li>
                <li className="flex items-start gap-2 text-sm text-slate-700">
                  <Check className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                  {tier.networks}
                </li>
                <li className="flex items-start gap-2 text-sm text-slate-700">
                  <Check
                    className={`h-4 w-4 flex-shrink-0 mt-0.5 ${
                      tier.subnetRouting ? "text-green-600" : "text-slate-300"
                    }`}
                  />
                  <span className={tier.subnetRouting ? "text-slate-700" : "text-slate-400"}>
                    Subnet routing
                  </span>
                </li>
                {tier.extras.map((e) => (
                  <li key={e} className="flex items-start gap-2 text-sm text-slate-700">
                    <Check className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                    {e}
                  </li>
                ))}
              </ul>

              <Link
                href="https://app.veldmesh.io/signup"
                className={`mt-8 block rounded-md px-4 py-2 text-center text-sm font-medium transition-colors ${
                  tier.highlighted
                    ? "bg-green-600 text-white hover:bg-green-700"
                    : "border border-slate-200 text-slate-900 hover:bg-slate-50"
                }`}
              >
                {tier.price === "$0" ? "Get started free" : `Start with ${tier.name}`}
              </Link>
            </div>
          ))}
        </div>

        {/* FAQ */}
        <div className="mx-auto mt-20 max-w-2xl">
          <h2 className="text-2xl font-bold text-slate-900 text-center mb-10">
            Frequently asked questions
          </h2>
          <div className="space-y-8">
            {faq.map(({ q, a }) => (
              <div key={q}>
                <h3 className="text-base font-semibold text-slate-900">{q}</h3>
                <p className="mt-2 text-slate-600 leading-relaxed">{a}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
