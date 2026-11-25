import type { ReactNode } from 'react';

export function EvidenceBox({
  label,
  heading,
  children,
}: {
  label: string;
  heading: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      aria-label={label}
      className="min-w-0 overflow-hidden rounded-md border"
    >
      <div className="flex min-h-8 items-center gap-2 border-b bg-muted/50 px-3 py-1 text-caption text-muted-foreground">
        {heading}
      </div>
      {children}
    </section>
  );
}
