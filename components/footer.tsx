// Copyright (c) 2026 Ironfeast Media, LLC. All rights reserved.
import Link from "next/link"

export function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex flex-col gap-1">
            <p className="text-sm text-slate-500">
              &copy; 2026 Ironfeast Media, LLC. All rights reserved.
            </p>
            <p className="text-xs text-slate-400">
              Veldmesh is a product of Ironfeast Media, LLC. Daemon &amp; CLI are MIT/BSL licensed.
            </p>
          </div>
          <div className="flex items-center gap-6">
            <Link
              href="https://github.com/veldmesh"
              className="text-sm text-slate-500 hover:text-slate-900 transition-colors"
            >
              GitHub
            </Link>
            <Link
              href="/docs"
              className="text-sm text-slate-500 hover:text-slate-900 transition-colors"
            >
              Docs
            </Link>
            <Link
              href="/privacy"
              className="text-sm text-slate-500 hover:text-slate-900 transition-colors"
            >
              Privacy
            </Link>
            <Link
              href="/security"
              className="text-sm text-slate-500 hover:text-slate-900 transition-colors"
            >
              Security
            </Link>
            <Link
              href="/terms"
              className="text-sm text-slate-500 hover:text-slate-900 transition-colors"
            >
              Terms
            </Link>
            <Link
              href="mailto:hello@veldmesh.io"
              className="text-sm text-slate-500 hover:text-slate-900 transition-colors"
            >
              Contact
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
