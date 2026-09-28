"use client"

import {
  CircleAlertIcon,
  CircleCheckIcon,
  CircleXIcon,
  InfoIcon,
  LoaderCircleIcon,
} from "lucide-react"
import { Toaster as Sonner, type ToasterProps } from "sonner"

// Light theme only, so no next-themes. `unstyled` drops sonner's own look
// (13px text, heavy shadow, 24px buttons) and every part is styled from the
// tokens here instead. TriangleAlert is not used: in Buildora it means "Disputed".
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      position="top-center"
      icons={{
        success: <CircleCheckIcon className="size-5 text-state-confirmed" />,
        info: <InfoIcon className="size-5 text-primary" />,
        warning: <CircleAlertIcon className="size-5 text-state-noreply" />,
        error: <CircleXIcon className="size-5 text-state-disputed" />,
        loading: (
          <LoaderCircleIcon className="size-5 animate-spin text-muted-foreground" />
        ),
      }}
      style={{ fontFamily: "inherit" }}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "flex w-full items-start gap-3 rounded-card border border-border bg-surface p-4 text-base text-ink shadow-sm",
          icon: "mt-0.5 flex shrink-0",
          content: "flex min-w-0 flex-1 flex-col gap-0.5",
          title: "font-semibold",
          description: "text-sm text-muted-foreground",
          actionButton:
            "inline-flex h-12 shrink-0 items-center rounded-control bg-primary px-4 text-base font-semibold text-primary-foreground hover:bg-primary/90",
          cancelButton:
            "inline-flex h-12 shrink-0 items-center rounded-control border border-input bg-surface px-4 text-base font-semibold text-ink hover:bg-primary-soft",
          closeButton:
            "absolute top-1 right-1 flex size-12 items-center justify-center rounded-control text-muted-foreground hover:bg-primary-soft hover:text-ink",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
