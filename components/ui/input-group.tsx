"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/ui/utils"

// The group draws the focus ring for the field inside it, so the inner
// input and textarea hide their own.
function InputGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="input-group"
      role="group"
      className={cn(
        "group/input-group relative flex h-12 w-full min-w-0 items-center rounded-control border border-input bg-surface transition-colors has-disabled:bg-bg has-disabled:opacity-50 has-[:is(input,textarea):focus-visible]:outline-3 has-[:is(input,textarea):focus-visible]:outline-offset-2 has-[:is(input,textarea):focus-visible]:outline-focus has-[[aria-invalid=true]]:border-destructive has-[[aria-invalid=true]]:shadow-[inset_0_0_0_1px_var(--color-destructive)] has-[>[data-align=block-end]]:h-auto has-[>[data-align=block-end]]:flex-col has-[>[data-align=block-start]]:h-auto has-[>[data-align=block-start]]:flex-col has-[>textarea]:h-auto has-[>[data-align=block-end]]:[&>input]:pt-3 has-[>[data-align=block-start]]:[&>input]:pb-3 has-[>[data-align=inline-end]]:[&>input]:pr-1.5 has-[>[data-align=inline-start]]:[&>input]:pl-1.5",
        className
      )}
      {...props}
    />
  )
}

const inputGroupAddonVariants = cva(
  "flex h-auto cursor-text items-center justify-center gap-2 py-2 text-base font-medium text-muted-foreground select-none group-data-[disabled=true]/input-group:opacity-50 [&>svg:not([class*='size-'])]:size-5",
  {
    variants: {
      align: {
        "inline-start": "order-first pl-3 has-[>button]:ml-[-0.25rem]",
        "inline-end": "order-last pr-3 has-[>button]:mr-[-0.25rem]",
        "block-start":
          "order-first w-full justify-start px-3 pt-2.5 group-has-[>input]/input-group:pt-2.5 [.border-b]:pb-2.5",
        "block-end":
          "order-last w-full justify-start px-3 pb-2.5 group-has-[>input]/input-group:pb-2.5 [.border-t]:pt-2.5",
      },
    },
    defaultVariants: {
      align: "inline-start",
    },
  }
)

function InputGroupAddon({
  className,
  align = "inline-start",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof inputGroupAddonVariants>) {
  return (
    <div
      role="group"
      data-slot="input-group-addon"
      data-align={align}
      className={cn(inputGroupAddonVariants({ align }), className)}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("button")) {
          return
        }
        e.currentTarget.parentElement?.querySelector("input")?.focus()
      }}
      {...props}
    />
  )
}

// Drawn at 40px to fit inside the 48px field; the after: layer extends the
// tap area to 48px.
const inputGroupButtonVariants = cva(
  "relative flex items-center gap-2 rounded-[calc(var(--radius-control)-2px)] shadow-none after:absolute after:-inset-1 after:content-['']",
  {
    variants: {
      size: {
        sm: "h-10 gap-1.5 px-3",
        "icon-sm": "size-10 p-0 has-[>svg]:p-0",
      },
    },
    defaultVariants: {
      size: "sm",
    },
  }
)

function InputGroupButton({
  className,
  type = "button",
  variant = "ghost",
  size = "sm",
  ...props
}: Omit<React.ComponentProps<typeof Button>, "size"> &
  VariantProps<typeof inputGroupButtonVariants>) {
  return (
    <Button
      type={type}
      data-size={size}
      variant={variant}
      className={cn(inputGroupButtonVariants({ size }), className)}
      {...props}
    />
  )
}

function InputGroupText({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "flex items-center gap-2 text-base text-muted-foreground [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-5",
        className
      )}
      {...props}
    />
  )
}

function InputGroupInput({
  className,
  ...props
}: React.ComponentProps<"input">) {
  return (
    <Input
      data-slot="input-group-control"
      className={cn(
        "h-full flex-1 rounded-none border-0 bg-transparent shadow-none focus-visible:outline-hidden disabled:bg-transparent aria-invalid:shadow-none",
        className
      )}
      {...props}
    />
  )
}

function InputGroupTextarea({
  className,
  ...props
}: React.ComponentProps<"textarea">) {
  return (
    <Textarea
      data-slot="input-group-control"
      className={cn(
        "flex-1 resize-none rounded-none border-0 bg-transparent py-2.5 shadow-none focus-visible:outline-hidden disabled:bg-transparent aria-invalid:shadow-none",
        className
      )}
      {...props}
    />
  )
}

export {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupText,
  InputGroupInput,
  InputGroupTextarea,
}
