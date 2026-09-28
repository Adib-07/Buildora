import * as React from "react"

import { cn } from "@/lib/ui/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-24 w-full rounded-control border border-input bg-surface px-3 py-2.5 text-base text-ink transition-colors placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:bg-bg disabled:opacity-50 aria-invalid:border-destructive aria-invalid:shadow-[inset_0_0_0_1px_var(--color-destructive)]",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
