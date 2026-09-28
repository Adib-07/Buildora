"use client";

import { useState } from "react";
import { ChevronsUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/ui/utils";

export type OwnerCandidate = { workerId: string; name: string };

/**
 * Ambiguous-candidate chips sit above the search combobox rather than
 * replacing it: a quick pick for the common case ("Suresh or Kiran"), with
 * the full roster search always one tap away.
 */
export function OwnerPicker({
  roster,
  candidates,
  value,
  onChange,
  placeholder = "Pick owner",
  className,
}: {
  roster: OwnerCandidate[];
  candidates?: OwnerCandidate[];
  value: string | null;
  onChange: (workerId: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = roster.find((w) => w.workerId === value) ?? candidates?.find((w) => w.workerId === value);

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {candidates && candidates.length > 0 && !value && (
        <div className="flex flex-wrap gap-2">
          {candidates.map((candidate) => (
            <button
              key={candidate.workerId}
              type="button"
              onClick={() => onChange(candidate.workerId)}
              className="min-h-12 rounded-full border border-primary bg-primary-soft px-4 font-semibold text-primary"
            >
              {candidate.name}
            </button>
          ))}
        </div>
      )}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn("w-full justify-between", !selected && "text-ink-muted")}
          >
            {selected?.name ?? placeholder}
            <ChevronsUpDown data-icon="inline-end" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-(--radix-popover-trigger-width) min-w-72 p-0">
          <Command>
            <CommandInput placeholder="Search the roster" />
            <CommandList>
              <CommandEmpty>No one matches.</CommandEmpty>
              <CommandGroup>
                {roster.map((worker) => (
                  <CommandItem
                    key={worker.workerId}
                    value={worker.name}
                    data-checked={worker.workerId === value}
                    onSelect={() => {
                      onChange(worker.workerId);
                      setOpen(false);
                    }}
                  >
                    {worker.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
