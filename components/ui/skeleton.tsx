import { cn } from "@/lib/ui/utils"

// Hidden from assistive tech by default: the loading region itself should say
// what is loading (aria-busy plus visible or sr-only text).
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      aria-hidden="true"
      data-slot="skeleton"
      className={cn("animate-pulse rounded-control bg-border", className)}
      {...props}
    />
  )
}

export { Skeleton }
