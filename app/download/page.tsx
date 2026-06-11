// Copyright (c) 2026 Ironfeast Media, LLC. All rights reserved.
import type { Metadata } from "next"
import { Terminal, Apple, Monitor, Box, Cpu } from "lucide-react"

export const metadata: Metadata = {
  title: "Download — Veld",
}

export default function DownloadPage() {
  return (
    <div className="bg-white py-20">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <h1 className="text-4xl font-bold text-slate-900">Download Veld</h1>
          <p className="mt-4 text-lg text-slate-600">
            One command installs the daemon and CLI on most platforms.
          </p>
        </div>

        <div className="space-y-8">
          {/* Linux */}
          <div className="rounded-xl border border-slate-200 p-8">
            <div className="flex items-center gap-3 mb-4">
              <Terminal className="h-6 w-6 text-slate-700" />
              <h2 className="text-xl font-semibold text-slate-900">Linux</h2>
            </div>
            <p className="text-sm text-slate-600 mb-4">
              x86_64, arm64, armv7 — systemd service installed automatically.
            </p>
            <div className="rounded-lg bg-slate-900 p-4">
              <pre className="font-mono text-sm text-green-400">
                curl -fsSL https://get.veldmesh.io/install.sh | sh
              </pre>
            </div>
          </div>

          {/* macOS */}
          <div className="rounded-xl border border-slate-200 p-8">
            <div className="flex items-center gap-3 mb-4">
              <Apple className="h-6 w-6 text-slate-700" />
              <h2 className="text-xl font-semibold text-slate-900">macOS</h2>
            </div>
            <p className="text-sm text-slate-600 mb-4">
              Apple Silicon and Intel. A LaunchDaemon plist is installed for autostart.
            </p>
            <div className="rounded-lg bg-slate-900 p-4">
              <pre className="font-mono text-sm text-green-400">
                brew install veld/tap/veld
              </pre>
            </div>
          </div>

          {/* Windows */}
          <div className="rounded-xl border border-slate-200 p-8">
            <div className="flex items-center gap-3 mb-4">
              <Monitor className="h-6 w-6 text-slate-700" />
              <h2 className="text-xl font-semibold text-slate-900">Windows</h2>
            </div>
            <p className="text-sm text-slate-600 mb-4">
              x86_64 installer. Installs a Windows Service and adds the CLI to your PATH.
              Requires Windows 10 1903+ (WireGuard kernel driver).
            </p>
            <a
              href="https://get.veldmesh.io/veld-setup.exe"
              className="inline-flex items-center gap-2 rounded-md bg-green-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-green-700 transition-colors"
            >
              Download installer (.exe)
            </a>
          </div>

          {/* Docker (coord server) */}
          <div className="rounded-xl border border-slate-200 p-8">
            <div className="flex items-center gap-3 mb-4">
              <Box className="h-6 w-6 text-slate-700" />
              <h2 className="text-xl font-semibold text-slate-900">
                Docker <span className="text-sm font-normal text-slate-500">(coord server only)</span>
              </h2>
            </div>
            <p className="text-sm text-slate-600 mb-4">
              Self-host the CE coordination server. State is stored in the <code className="rounded bg-slate-100 px-1">/data</code> volume.
            </p>
            <div className="rounded-lg bg-slate-900 p-4">
              <pre className="font-mono text-sm text-green-400 whitespace-pre-wrap">
                {`docker run -d \\
  -p 50051:50051 \\
  -v data:/data \\
  veld/coord`}
              </pre>
            </div>
          </div>

          {/* OpenWrt */}
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-8">
            <div className="flex items-center gap-3 mb-4">
              <Cpu className="h-6 w-6 text-amber-700" />
              <h2 className="text-xl font-semibold text-slate-900">OpenWrt / MIPS / ARMv6</h2>
            </div>
            <p className="text-sm text-slate-600 mb-4">
              Veld ships pre-built packages for OpenWrt 22.03+ on MIPS24kc, MIPS32, and ARMv6.
              The install script detects the OpenWrt environment automatically.
            </p>
            <div className="rounded-lg bg-slate-900 p-4">
              <pre className="font-mono text-sm text-green-400">
                curl -fsSL https://get.veldmesh.io/install.sh | sh
              </pre>
            </div>
            <p className="mt-4 text-xs text-amber-800">
              Note: The tun kernel module must be loaded (<code>modprobe tun</code>). Most OpenWrt
              builds include it. MIPS builds are statically linked and have no external dependencies.
            </p>
          </div>
        </div>

        <div className="mt-12 rounded-xl bg-slate-50 p-8 text-center">
          <h3 className="text-lg font-semibold text-slate-900">Verify your download</h3>
          <p className="mt-2 text-sm text-slate-600">
            All releases are signed with our Ed25519 release key. Checksums and signatures are
            published at{" "}
            <a
              href="https://get.veldmesh.io/checksums.txt"
              className="text-green-600 hover:underline"
            >
              get.veldmesh.io/checksums.txt
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  )
}
