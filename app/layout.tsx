// Copyright (c) 2026 Ironfeast Media, LLC. All rights reserved.
import type { Metadata } from "next"
import "./globals.css"
import { Nav } from "@/components/nav"
import { Footer } from "@/components/footer"

export const metadata: Metadata = {
  title: "Veld — Zero-trust mesh VPN",
  description:
    "Per-network pricing, not per-user. End-to-end encrypted with Noise IK — the coordination server never carries your traffic.",
  icons: { icon: "/logo.png", apple: "/logo.png" },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans text-slate-900 bg-white">
        <div className="flex min-h-screen flex-col">
          <Nav />
          <main className="flex-1">{children}</main>
          <Footer />
        </div>
      </body>
    </html>
  )
}
