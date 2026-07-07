import React from "react"
import { cn } from "@/lib/utils"

export interface StatusDotProps {
  status: "all_received" | "waiting" | "backordered" | "received"
  className?: string
}

export function StatusDot({ status, className }: StatusDotProps) {
  return (
    <div
      className={cn(
        "h-3 w-3 rounded-full flex-shrink-0",
        {
          "bg-green-500 shadow-[0_0_0_2px_rgba(34,197,94,0.2)]": status === "all_received" || status === "received",
          "bg-yellow-400 shadow-[0_0_0_2px_rgba(250,204,21,0.2)]": status === "waiting",
          "bg-red-500 shadow-[0_0_0_2px_rgba(239,68,68,0.2)]": status === "backordered",
        },
        className
      )}
      title={
        status === "all_received" || status === "received"
          ? "All Received"
          : status === "waiting"
          ? "Waiting on Parts"
          : "Backordered"
      }
    />
  )
}
