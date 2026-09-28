import { cn } from '@/lib/ui/utils';

/**
 * The Buildora mark: a rising chevron over a base line -- a site plan and a
 * structure being built up. Drawn inline as SVG so it inherits `currentColor`
 * and needs no extra request, and so it stays crisp at any size.
 */
export function Logo({ className, ...props }: React.ComponentProps<'svg'>) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={cn('size-8', className)}
      {...props}
    >
      <rect width="32" height="32" rx="8" className="fill-primary" />
      <path
        d="M8 21.5 16 13l4 4 4-5"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-primary-foreground"
      />
      <path
        d="M8 25h16"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
        className="text-primary-foreground opacity-70"
      />
    </svg>
  );
}

/**
 * Wordmark. `Buildora` is set in the semibold UI weight and the `.ora` suffix is
 * left in the primary colour, so the name reads as one word rather than a
 * logo lockup.
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('text-lg font-semibold tracking-tight text-ink', className)}>
      Build
      <span className="text-primary">ora</span>
    </span>
  );
}

export function BrandLockup({ className }: { className?: string }) {
  return (
    <span className={cn('flex items-center gap-2', className)}>
      <Logo />
      <Wordmark />
    </span>
  );
}
