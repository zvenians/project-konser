import * as React from "react"

import { cn } from "@/lib/utils"

function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        "inline-flex h-6 min-w-6 select-none items-center justify-center gap-0.5 rounded-md border border-border bg-surface px-1.5 font-mono text-[11px] font-medium text-muted-foreground shadow-[0_1px_0_var(--border)]",
        className
      )}
      {...props}
    />
  )
}

export { Kbd }
