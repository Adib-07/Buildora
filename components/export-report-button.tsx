"use client";

import { useState, useTransition } from "react";
import { CheckIcon, CopyIcon, DownloadIcon, PrinterIcon, Share2Icon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Share / Export.
 *
 * The report is generated on the server from the caller's own rows and handed to
 * this component as a string, so there is no client fetch, no loading state and
 * no way for the browser to produce a report the server would not have produced
 * too.
 *
 * Three targets, because a supervisor sharing a shift report is doing one of
 * three things: pasting it into a message (copy), attaching it to a ticket
 * (download), or showing it on a screen in the site office (print).
 *
 * The print path deliberately does not open a new window with inlined HTML --
 * that would mean serialising untrusted worker-supplied text into a document,
 * which is how a `</script>` in a hazard report turns into script execution.
 * Instead it prints the current document, where the React tree already escaped
 * everything it rendered.
 */

export function ExportReportButton({
  markdown,
  filename,
  summary,
}: {
  markdown: string;
  filename: string;
  /** One line for the trigger, e.g. "Export shift report". */
  summary: string;
}) {
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  async function copy() {
    try {
      // execCommand is the fallback for browsers and contexts where the async
      // clipboard API is unavailable (an http origin, or a denied permission).
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(markdown);
      } else {
        fallbackCopy(markdown);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      fallbackCopy(markdown);
      setCopied(false);
      toast.error("Could not copy — use Download instead.");
    }
  }

  function download() {
    startTransition(() => {
      const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      // Revoked on the next tick, not immediately: Safari cancels an in-flight
      // download if the object URL disappears in the same task.
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success(`Downloaded ${filename}`);
    });
  }

  function print() {
    startTransition(() => {
      window.print();
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={pending} title={summary}>
          <Share2Icon aria-hidden="true" />
          <span className="hidden sm:inline">Export</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52">
        <DropdownMenuItem onSelect={copy}>
          {copied ? (
            <CheckIcon className="text-state-confirmed" aria-hidden="true" />
          ) : (
            <CopyIcon aria-hidden="true" />
          )}
          {copied ? "Copied" : "Copy as Markdown"}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={download}>
          <DownloadIcon aria-hidden="true" />
          Download .md
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={print}>
          <PrinterIcon aria-hidden="true" />
          Print this page
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** textarea + execCommand: deprecated, but the only path that always exists. */
function fallbackCopy(text: string) {
  const area = document.createElement("textarea");
  area.value = text;
  // Kept in the DOM and selected: a detached textarea cannot be focused, and
  // Safari will not copy from one.
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.select();
  try {
    document.execCommand("copy");
  } finally {
    area.remove();
  }
}
