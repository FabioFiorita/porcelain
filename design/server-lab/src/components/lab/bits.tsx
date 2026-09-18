import { cn } from 'cn';
import { CircleAlert, CircleCheck, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { originLabel } from '@/lib/format';

export function OriginDot({
  origin,
  label = true,
}: {
  origin: string;
  label?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span
        className="size-2 shrink-0 rounded-full"
        style={{ background: `var(--lab-${origin})` }}
      />
      {label && (originLabel[origin] ?? origin)}
    </span>
  );
}

const methodTone: Record<string, string> = {
  GET: 'text-[var(--series-blue)]',
  POST: 'text-[var(--series-orange)]',
  PUT: 'text-[var(--series-violet)]',
  DELETE: 'text-[var(--lab-danger)]',
  BACKGROUND: 'text-muted-foreground',
};

export function Method({
  method,
  className,
}: {
  method: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-block w-12 shrink-0 font-mono text-[11px] font-semibold tracking-tight',
        methodTone[method] ?? 'text-muted-foreground',
        className,
      )}
    >
      {method === 'BACKGROUND' ? 'BG' : method}
    </span>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: 'ok' | 'warn' | 'danger';
}) {
  return (
    <div className="min-w-0 rounded-xl border bg-card px-3 py-2">
      <div className="truncate text-xs text-muted-foreground">{label}</div>
      <div
        className={cn(
          'mt-0.5 text-lg font-semibold tabular-nums',
          tone === 'danger' && 'text-[var(--lab-danger)]',
        )}
      >
        {value}
      </div>
      {hint && (
        <div className="truncate text-xs text-muted-foreground">{hint}</div>
      )}
    </div>
  );
}

export function Section({
  title,
  description,
  actions,
  children,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('space-y-3', className)}>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">{title}</h2>
          {description && (
            <p className="mt-0.5 max-w-3xl text-sm text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        )}
      </div>
      {children}
    </section>
  );
}

/** Status never relies on color alone: icon + label. */
export function StatusMark({
  status,
  children,
}: {
  status: 'ok' | 'warn' | 'danger';
  children: ReactNode;
}) {
  const Icon =
    status === 'ok'
      ? CircleCheck
      : status === 'warn'
        ? TriangleAlert
        : CircleAlert;
  return (
    <span className="inline-flex items-center gap-1 text-xs">
      <Icon
        className="size-3.5"
        style={{
          color:
            status === 'ok'
              ? 'var(--lab-ok)'
              : status === 'warn'
                ? 'var(--lab-warn)'
                : 'var(--lab-danger)',
        }}
      />
      {children}
    </span>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px] text-foreground">
      {children}
    </code>
  );
}
