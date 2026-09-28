import * as React from "react"

import { cn } from "@/lib/ui/utils"

// 16px text at every width (smaller text makes iOS zoom in on focus).
// Invalid adds an inset 1px so the border reads as 2px without shifting layout.
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-12 w-full min-w-0 rounded-control border border-input bg-surface px-3 py-2 text-base text-ink transition-colors file:inline-flex file:h-8 file:border-0 file:bg-transparent file:text-base file:font-medium file:text-ink placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-bg disabled:opacity-50 aria-invalid:border-destructive aria-invalid:shadow-[inset_0_0_0_1px_var(--color-destructive)]",
        className
      )}
      {...props}
    />
  )
}

export { Input }
