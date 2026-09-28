import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/ui/utils"

// Every size is at least 48px tall: supervisors tap these outdoors, one-handed.
// Focus uses the global 3px ring from app/globals.css, so no outline-none here.
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-2 rounded-control border border-transparent bg-clip-padding text-base font-semibold whitespace-nowrap transition-[transform,background-color,border-color,color,box-shadow] duration-150 ease-out select-none active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        outline:
          "border-input bg-surface text-ink hover:bg-primary-soft aria-expanded:bg-primary-soft",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--color-secondary),var(--color-primary)_8%)] aria-expanded:bg-[color-mix(in_oklch,var(--color-secondary),var(--color-primary)_8%)]",
        ghost:
          "text-ink hover:bg-primary-soft aria-expanded:bg-primary-soft",
        destructive:
          "bg-state-disputed-bg text-state-disputed hover:bg-[color-mix(in_oklch,var(--color-state-disputed-bg),var(--color-state-disputed)_10%)]",
        link: "text-primary underline underline-offset-4 hover:decoration-2",
      },
      size: {
        default:
          "h-12 px-5 has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4",
        lg: "h-14 px-6 text-lg has-data-[icon=inline-end]:pr-5 has-data-[icon=inline-start]:pl-5",
        icon: "size-12",
        "icon-lg": "size-14 [&_svg:not([class*='size-'])]:size-6",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
