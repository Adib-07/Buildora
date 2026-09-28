import {
  ArrowRight,
  ChevronsUpDown,
  CircleAlert,
  ClipboardCheck,
  HelpCircle,
  LoaderCircle,
  Lock,
  Mic,
  RefreshCw,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { Section, Subsection } from "../_components/section";
import { ToastDemo } from "../_components/toast-demo";

const TEAMS = ["Masonry", "Shuttering", "Steel", "Helpers"];

export function Primitives() {
  return (
    <>
      <Section id="buttons" title="Buttons">
        <Subsection title="Variants">
          <div className="flex flex-wrap gap-3">
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Destructive</Button>
            <Button variant="link">Link</Button>
          </div>
        </Subsection>
        <Subsection title="Sizes and icons">
          <div className="flex flex-wrap items-center gap-3">
            <Button size="lg">Large</Button>
            <Button>
              <ClipboardCheck data-icon="inline-start" />
              Roll-call
            </Button>
            <Button variant="outline">
              Plan tasks
              <ArrowRight data-icon="inline-end" />
            </Button>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Refresh">
                  <RefreshCw />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Refresh</TooltipContent>
            </Tooltip>
            <Button size="icon-lg" aria-label="Record voice">
              <Mic />
            </Button>
          </div>
        </Subsection>
        <Subsection title="States">
          <div className="flex flex-wrap gap-3">
            <Button disabled>Disabled</Button>
            <Button variant="outline" disabled>
              Disabled
            </Button>
            <Button disabled>
              <LoaderCircle data-icon="inline-start" className="animate-spin" />
              Saving…
            </Button>
          </div>
        </Subsection>
      </Section>

      <Section
        id="badges"
        title="Badges"
        description="Labels, not controls: pill-shaped so they never read as buttons, and never links (too small to tap). Worker-state and severity badges (icon + word + colour) come with the product components in step 2."
      >
        <div className="flex flex-wrap items-center gap-3">
          <Badge>Default</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="destructive">Destructive</Badge>
          <Badge variant="outline">Outline</Badge>
          <Badge variant="outline">
            <Lock data-icon="inline-start" />
            Locked
          </Badge>
        </div>
      </Section>

      <Section id="cards" title="Cards">
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Masonry</CardTitle>
              <CardDescription>12 workers</CardDescription>
              <CardAction>
                <Badge variant="secondary" className="tabular-nums">
                  12
                </Badge>
              </CardAction>
            </CardHeader>
            <CardContent>
              <p>Card body text: 16px ink on surface.</p>
            </CardContent>
            <CardFooter>
              <Button variant="outline" className="w-full">
                Open team
              </Button>
            </CardFooter>
          </Card>
          <Card size="sm">
            <CardHeader>
              <CardTitle>Small card</CardTitle>
              <CardDescription>12px spacing instead of 16px</CardDescription>
            </CardHeader>
            <CardContent>
              <p>For dense lists on the office screen.</p>
            </CardContent>
          </Card>
        </div>
      </Section>

      <Section id="forms" title="Forms" description="Every field has a visible label. Errors pair the red border with an icon and text.">
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <label htmlFor="ks-name" className="font-medium">
              Worker name
            </label>
            <Input id="ks-name" placeholder="e.g. Ramesh" aria-describedby="ks-name-hint" />
            <p id="ks-name-hint" className="text-sm text-ink-muted">
              Telugu script is fine.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="ks-phone" className="font-medium">
              Phone number
            </label>
            <Input
              id="ks-phone"
              type="tel"
              inputMode="tel"
              defaultValue="98480 123"
              aria-invalid="true"
              aria-describedby="ks-phone-error"
            />
            <p id="ks-phone-error" className="flex items-center gap-1.5 text-sm font-medium text-state-disputed">
              <CircleAlert className="size-4 shrink-0" />
              Enter a 10-digit mobile number.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="ks-code" className="font-medium">
              Worker code
            </label>
            <Input id="ks-code" defaultValue="4821" disabled className="tabular-nums" />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="ks-team" className="font-medium">
              Team
            </label>
            <Select>
              <SelectTrigger id="ks-team">
                <SelectValue placeholder="Choose a team" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Teams</SelectLabel>
                  {TEAMS.map((team) => (
                    <SelectItem key={team} value={team.toLowerCase()}>
                      {team}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2 sm:col-span-2">
            <label htmlFor="ks-note" className="font-medium">
              Note
            </label>
            <Textarea id="ks-note" placeholder="What happened?" />
          </div>
        </div>
      </Section>

      <Section id="tabs" title="Tabs" description="The active tab is marked by shape as well as colour.">
        <div className="grid gap-6 lg:grid-cols-2">
          <Tabs defaultValue="today">
            <TabsList>
              <TabsTrigger value="today">Today</TabsTrigger>
              <TabsTrigger value="week">This week</TabsTrigger>
            </TabsList>
            <TabsContent value="today" className="rounded-card border border-border bg-surface p-4">
              Default variant, today panel.
            </TabsContent>
            <TabsContent value="week" className="rounded-card border border-border bg-surface p-4">
              Default variant, this week panel.
            </TabsContent>
          </Tabs>
          <Tabs defaultValue="phone-1">
            <TabsList variant="line" className="w-full">
              <TabsTrigger value="phone-1">Phone 1</TabsTrigger>
              <TabsTrigger value="phone-2">Phone 2</TabsTrigger>
              <TabsTrigger value="phone-3">Phone 3</TabsTrigger>
            </TabsList>
            <TabsContent value="phone-1">Line variant, phone 1 panel.</TabsContent>
            <TabsContent value="phone-2">Line variant, phone 2 panel.</TabsContent>
            <TabsContent value="phone-3">Line variant, phone 3 panel.</TabsContent>
          </Tabs>
        </div>
      </Section>

      <Section id="overlays" title="Overlays">
        <div className="flex flex-wrap gap-3">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline">Dialog</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Discard changes?</DialogTitle>
                <DialogDescription>Your edits to this record will be lost.</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Keep editing</Button>
                </DialogClose>
                <DialogClose asChild>
                  <Button variant="destructive">Discard</Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline">Bottom sheet</Button>
            </SheetTrigger>
            <SheetContent side="bottom">
              <SheetHeader>
                <SheetTitle>Bottom sheet</SheetTitle>
                <SheetDescription>The phone pattern. AttendanceSheet builds on it in step 2.</SheetDescription>
              </SheetHeader>
              <div className="flex flex-col gap-2 px-4">
                <label htmlFor="ks-sheet-hours" className="font-medium">
                  Hours
                </label>
                <Input id="ks-sheet-hours" inputMode="decimal" defaultValue="8" className="tabular-nums" />
              </div>
              <SheetFooter>
                <SheetClose asChild>
                  <Button>Save</Button>
                </SheetClose>
              </SheetFooter>
            </SheetContent>
          </Sheet>

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline">Side sheet</Button>
            </SheetTrigger>
            <SheetContent side="right">
              <SheetHeader>
                <SheetTitle>Side sheet</SheetTitle>
                <SheetDescription>For wider screens.</SheetDescription>
              </SheetHeader>
            </SheetContent>
          </Sheet>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline">Popover</Button>
            </PopoverTrigger>
            <PopoverContent>
              <PopoverHeader>
                <PopoverTitle>Popover</PopoverTitle>
                <PopoverDescription>Anchored to the button that opened it.</PopoverDescription>
              </PopoverHeader>
            </PopoverContent>
          </Popover>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Help">
                <HelpCircle />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Tooltips supplement visible text; touch screens never show them.</TooltipContent>
          </Tooltip>
        </div>
      </Section>

      <Section
        id="command"
        title="Command"
        description="A searchable list in a popover, the base for OwnerPicker in step 2. Arrow keys move the ring; a chosen row shows a check."
      >
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-full max-w-sm justify-between">
              Pick a worker
              <ChevronsUpDown data-icon="inline-end" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-(--radix-popover-trigger-width) min-w-72 p-0">
            <Command label="Search the roster">
              <CommandInput placeholder="Search the roster" />
              <CommandList>
                <CommandEmpty>No one matches.</CommandEmpty>
                <CommandGroup heading="Masonry">
                  <CommandItem>Ramesh</CommandItem>
                  <CommandItem data-checked="true">Lakshmi</CommandItem>
                  <CommandItem value="Venkat వెంకట్">
                    <span lang="te">వెంకట్</span>
                  </CommandItem>
                </CommandGroup>
                <CommandSeparator />
                <CommandGroup heading="Steel">
                  <CommandItem>Suresh</CommandItem>
                  <CommandItem>Kiran</CommandItem>
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </Section>

      <Section id="feedback" title="Feedback">
        <Subsection title="Toasts">
          <ToastDemo />
        </Subsection>
        <Subsection title="Skeleton">
          <div aria-busy="true" className="flex flex-col gap-4 rounded-card border border-border bg-surface p-4">
            <span className="sr-only">Loading workers</span>
            {[0, 1, 2].map((row) => (
              <div key={row} className="flex items-center gap-3">
                <Skeleton className="size-12 rounded-full" />
                <div className="flex flex-1 flex-col gap-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-4 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        </Subsection>
      </Section>
    </>
  );
}
