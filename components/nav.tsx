// Copyright (c) 2026 Ironfeast Media, LLC. All rights reserved.
"use client"

import Link from "next/link"
import { useState } from "react"
import { Menu, X } from "lucide-react"
import Image from "next/image"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.veldmesh.io"

const links = [
  { href: "/features", label: "Features" },
  { href: "/pricing", label: "Pricing" },
  { href: "/docs", label: "Docs" },
  { href: "/download", label: "Download" },
]

export function Nav() {
  const [open, setOpen] = useState(false)

  return (
    <nav className="border-b border-slate-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2">
              <Image src="/logo.png" alt="Veld" width={24} height={24} priority />
              <span className="text-lg font-semibold text-slate-900">Veld</span>
            </Link>
            <div className="hidden md:flex items-center gap-6">
              {links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="text-sm text-slate-600 hover:text-slate-900 transition-colors"
                >
                  {l.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="hidden md:flex items-center gap-4">
            <a
              href={`${APP_URL}/login`}
              className="text-sm text-slate-600 hover:text-slate-900 transition-colors"
            >
              Sign in
            </a>
            <a
              href={`${APP_URL}/signup`}
              className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 transition-colors"
            >
              Get started
            </a>
          </div>

          <button
            className="md:hidden rounded-md p-2 text-slate-600 hover:bg-slate-100"
            onClick={() => setOpen(!open)}
            aria-label="Toggle menu"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 py-4 space-y-3">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="block text-sm text-slate-600 hover:text-slate-900"
              onClick={() => setOpen(false)}
            >
              {l.label}
            </Link>
          ))}
          <div className="pt-3 border-t border-slate-100 space-y-2">
            <a
              href={`${APP_URL}/login`}
              className="block text-sm text-slate-600"
            >
              Sign in
            </a>
            <a
              href={`${APP_URL}/signup`}
              className="block rounded-md bg-green-600 px-4 py-2 text-center text-sm font-medium text-white"
            >
              Get started
            </a>
          </div>
        </div>
      )}
    </nav>
  )
}
