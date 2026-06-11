// Copyright (c) 2026 Ironfeast Media, LLC. All rights reserved.
import type { Metadata } from "next"
import { Lock, Wifi, RouteOff, Server } from "lucide-react"

export const metadata: Metadata = {
  title: "Features — Veld",
}

const sections = [
  {
    icon: Lock,
    title: "Noise IK encryption",
    body: [
      "Ed25519 identity keys establish trust on first contact. X25519 ephemeral keys negotiate each session for forward secrecy. ChaCha20-Poly1305 encrypts every packet on the data plane.",
      "The coordination server only ever sees public keys and IP addresses — it is structurally incapable of performing a man-in-the-middle attack because it never touches session key material.",
    ],
    detail: "Protocol: Noise_IK_25519_ChaChaPoly_BLAKE2s",
  },
  {
    icon: Wifi,
    title: "NAT traversal",
    body: [
      "UDP hole-punching succeeds for roughly 85% of real-world NAT configurations, covering symmetric NAT, full-cone NAT, and port-restricted NAT.",
      "For the remaining 15%, Veld relays traffic through a mesh peer — never through the coord server. Your data stays off our infrastructure.",
    ],
    detail: "No coord-server relay. Ever.",
  },
  {
    icon: RouteOff,
    title: "Subnet routing",
    body: [
      "Advertise a LAN prefix from a single gateway machine. All peers on the network gain access to that subnet automatically — no configuration changes on the LAN devices.",
      "Perfect for the IoT gateway pattern: install Veld on a Raspberry Pi, advertise 192.168.1.0/24, and reach every device on that segment from anywhere.",
    ],
    detail: "Available on Teams and above.",
  },
  {
    icon: Server,
    title: "Self-hosting",
    body: [
      "The CE coordination server is released under BSL (Business Source License), which converts to Apache 2.0 four years after each release. Run it anywhere — bare metal, VPS, or Kubernetes.",
      "Single static binary with embedded SQLite. Docker image available. OpenWrt packages built for MIPS and ARMv6. The daemon is MIT licensed — fork it, audit it, embed it.",
    ],
    detail: "docker run veld/coord",
  },
]

export default function FeaturesPage() {
  return (
    <div className="bg-white py-20">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold text-slate-900">Built for engineers who care about the details</h1>
          <p className="mt-4 text-lg text-slate-600">
            Auditable crypto, open-source daemon, no forced relay.
          </p>
        </div>

        <div className="space-y-16">
          {sections.map(({ icon: Icon, title, body, detail }) => (
            <div key={title} className="flex flex-col sm:flex-row gap-8">
              <div className="flex-shrink-0">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-50">
                  <Icon className="h-6 w-6 text-green-600" />
                </div>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
                {body.map((p, i) => (
                  <p key={i} className="mt-3 text-slate-600 leading-relaxed">
                    {p}
                  </p>
                ))}
                <p className="mt-4 inline-block rounded-md bg-slate-100 px-3 py-1 font-mono text-xs text-slate-700">
                  {detail}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
