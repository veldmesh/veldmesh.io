// Copyright (c) 2026 Ironfeast Media, LLC. All rights reserved.
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Docs — Veld",
}

const cliCommands = [
  { cmd: "veld login", desc: "Authenticate with the coord server" },
  { cmd: "veld up", desc: "Bring up the VPN interface" },
  { cmd: "veld down", desc: "Bring down the VPN interface" },
  { cmd: "veld status", desc: "Show peer list and connection status" },
  { cmd: "veld peers", desc: "List all peers with latency and last-seen" },
  { cmd: "veld routes advertise <prefix>", desc: "Advertise a subnet route" },
  { cmd: "veld routes withdraw <prefix>", desc: "Withdraw a subnet route" },
  { cmd: "veld network create <name>", desc: "Create a new network (managed)" },
  { cmd: "veld network join <token>", desc: "Join a network with an invite token" },
  { cmd: "veld version", desc: "Print daemon and protocol versions" },
]

export default function DocsPage() {
  return (
    <div className="bg-white py-16">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <h1 className="text-4xl font-bold text-slate-900 mb-10">Documentation</h1>

        {/* Quick start */}
        <section id="quick-start" className="mb-14">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Quick start</h2>
          <p className="text-slate-600 mb-6">Three commands to get connected:</p>
          <div className="rounded-xl bg-slate-900 p-6">
            <pre className="overflow-x-auto font-mono text-sm text-green-400 leading-relaxed">
              {`# 1. Install
curl -fsSL https://get.veldmesh.io/install.sh | sh

# 2. Authenticate
veld login

# 3. Bring up the interface
veld up --network <your-network-id>`}
            </pre>
          </div>
          <p className="mt-4 text-sm text-slate-500">
            The install script detects your OS and architecture. Supports Linux (x86_64, arm64,
            MIPS), macOS (arm64, x86_64), and Windows.
          </p>
        </section>

        {/* Static config mode */}
        <section id="static-config" className="mb-14">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Static config mode</h2>
          <p className="text-slate-600 mb-4 leading-relaxed">
            You can run Veld without any coord server using a static TOML config. Useful for
            fully air-gapped environments or two-machine setups where you control both peers.
          </p>
          <div className="rounded-xl bg-slate-900 p-6">
            <pre className="overflow-x-auto font-mono text-sm text-green-400 leading-relaxed">
              {`# /etc/veld/config.toml
[node]
private_key = "base64-encoded-ed25519-private-key"
listen_port = 51820

[[peers]]
public_key  = "base64-encoded-peer-public-key"
endpoint    = "203.0.113.42:51820"
allowed_ips = ["10.0.0.2/32"]`}
            </pre>
          </div>
          <p className="mt-4 text-sm text-slate-500">
            Run with <code className="rounded bg-slate-100 px-1 py-0.5">veld up --config /etc/veld/config.toml</code>.
            No login required.
          </p>
        </section>

        {/* Self-hosting */}
        <section id="self-hosting" className="mb-14">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Self-hosting the coord server</h2>
          <p className="text-slate-600 mb-4 leading-relaxed">
            The CE coordination server is a single static binary. It stores state in bbolt — a
            single embedded database file on disk.
          </p>
          <div className="rounded-xl bg-slate-900 p-6">
            <pre className="overflow-x-auto font-mono text-sm text-green-400 leading-relaxed">
              {`# Point the daemon at your server
veld login --server grpc://your-coord:50051`}
            </pre>
          </div>
          <p className="mt-4 text-sm text-slate-500">
            Self-hosted installs operate under Free-tier limits (5 machines, 1 network). Upgrade by
            connecting to the managed cloud or running the managed coord server.
          </p>
        </section>

        {/* NAT traversal */}
        <section id="nat-traversal" className="mb-14">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">NAT traversal</h2>
          <p className="text-slate-600 leading-relaxed">
            Veld uses UDP hole-punching coordinated through the coord server. The coord server
            tells each peer the other's discovered public endpoint; both peers simultaneously send
            UDP packets to open the NAT pinholes. This succeeds for ~85% of real-world NATs.
          </p>
          <p className="mt-3 text-slate-600 leading-relaxed">
            For the ~15% where direct connection fails (symmetric NAT behind symmetric NAT),
            peers fall back to the relay — never through the coordination server. The relay
            forwards encrypted traffic and sees connection metadata (IPs, timing, volume), not
            content. The relay server is open source (cmd/veld-relay).
          </p>
        </section>

        {/* Subnet routing */}
        <section id="subnet-routing" className="mb-14">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Subnet routing</h2>
          <p className="text-slate-600 leading-relaxed">
            A machine with subnet routing enabled can advertise a CIDR prefix to the network. All
            other peers route traffic for that prefix through the advertising machine. Requires Teams
            plan or above.
          </p>
          <div className="mt-4 rounded-xl bg-slate-900 p-6">
            <pre className="overflow-x-auto font-mono text-sm text-green-400 leading-relaxed">
              {`# On the gateway machine
veld routes advertise 192.168.1.0/24

# All other peers can now reach the LAN
ping 192.168.1.100`}
            </pre>
          </div>
        </section>

        {/* CLI reference */}
        <section id="cli-reference" className="mb-14">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">CLI reference</h2>
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-slate-700">Command</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-700">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cliCommands.map(({ cmd, desc }) => (
                  <tr key={cmd}>
                    <td className="px-4 py-3 font-mono text-xs text-slate-800 whitespace-nowrap">
                      {cmd}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  )
}
