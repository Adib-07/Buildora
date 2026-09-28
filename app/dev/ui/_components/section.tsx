export function Section({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-4 border-t border-border pt-8">
      <h2 id={`${id}-title`} className="text-2xl font-semibold">
        {title}
      </h2>
      {description && <p className="mt-1 max-w-prose text-ink-muted">{description}</p>}
      <div className="mt-5 flex flex-col gap-6">{children}</div>
    </section>
  );
}

export function Subsection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-lg font-semibold">{title}</h3>
      {children}
    </div>
  );
}
