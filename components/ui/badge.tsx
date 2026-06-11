// Copyright (c) 2026 Ironfeast Media, LLC. All rights reserved.
import { clsx } from "clsx"

type Variant = "online" | "offline" | "free" | "plus" | "teams" | "business"

const variants: Record<Variant, string> = {
  online: "bg-green-100 text-green-800",
  offline: "bg-slate-100 text-slate-600",
  free: "bg-slate-100 text-slate-700",
  plus: "bg-blue-100 text-blue-700",
  teams: "bg-purple-100 text-purple-700",
  business: "bg-amber-100 text-amber-700",
}

export function Badge({ variant, children }: { variant: Variant; children: React.ReactNode }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        variants[variant]
      )}
    >
      {children}
    </span>
  )
}
