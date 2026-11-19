import { type ReactNode, useId } from 'react';
import { createPortal } from 'react-dom';
import { useAtomSet, useAtomValue } from '@effect/atom-react';
import { cn } from 'cn';
import { pendingRegions } from '@/shared/store';
import { PENDING_DELAY_MS, PENDING_GRACE_MS } from '@/config/limits';
import { Spinner } from '@/components/ui/spinner';
import { Button } from '@/components/ui/button';

export function PendingSpinner({
  label,
  className,
  startedAt,
}: {
  label: string;
  className?: string;
  startedAt?: number;
}) {
  const delay =
    startedAt === undefined
      ? PENDING_DELAY_MS
      : startedAt + PENDING_DELAY_MS - Date.now();
  return (
    <span
      className={cn(
        'pending-appear inline-flex text-muted-foreground',
        className,
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      <Spinner aria-label={label} />
    </span>
  );
}

export function StateSpinner({ label }: { label: string }) {
  const id = useId();
  const setRegions = useAtomSet(pendingRegions);
  return (
    <div
      className="relative min-h-24 w-full flex-1"
      ref={(element) => {
        if (!element?.checkVisibility({ visibilityProperty: true })) return;
        const { left, top, width, height } = element.getBoundingClientRect();
        const region = {
          id,
          label,
          element,
          box: { left, top, width, height },
        };
        setRegions((state) => {
          const others = state.regions.filter((entry) => entry.id !== id);
          const now = Date.now();
          return {
            regions: [...others, region],
            last: region,
            idleSince: state.idleSince,
            startedAt:
              others.length === 0 && now - state.idleSince > PENDING_GRACE_MS
                ? now
                : state.startedAt,
          };
        });
        return () => {
          const shown = element.isConnected
            ? element.checkVisibility({ visibilityProperty: true })
            : element.closest('[aria-hidden="true"]') === null;
          setRegions((state) => {
            const regions = state.regions.filter((entry) => entry.id !== id);
            return {
              regions,
              last:
                shown && Date.now() - state.startedAt >= PENDING_DELAY_MS
                  ? state.regions.find((entry) => entry.id === id)
                  : undefined,
              startedAt: state.startedAt,
              idleSince:
                regions.length === 0 && state.regions.length > 0
                  ? Date.now()
                  : state.idleSince,
            };
          });
        };
      }}
    />
  );
}

export function PendingIndicator() {
  const { regions, last, startedAt } = useAtomValue(pendingRegions);
  const owner = regions.at(-1);
  if (owner)
    return createPortal(
      <span className="pointer-events-none absolute inset-0 grid place-items-center">
        <PendingSpinner label={owner.label} startedAt={startedAt} />
      </span>,
      owner.element,
    );
  if (last === undefined) return null;
  return (
    <div
      key={startedAt}
      className="pending-linger pointer-events-none fixed grid place-items-center"
      style={last.box}
    >
      <PendingSpinner label={last.label} startedAt={startedAt} />
    </div>
  );
}

export function StateNotice({
  message,
  action,
  role,
}: {
  message: ReactNode;
  action?: ReactNode;
  role?: 'alert' | 'status';
}) {
  return (
    <section
      data-slot="state-notice"
      role={role}
      className="flex w-full min-w-0 max-w-xl flex-wrap items-center gap-x-3 gap-y-2 p-6 text-ui text-muted-foreground"
    >
      <p className="min-w-0 [overflow-wrap:anywhere]">{message}</p>
      {action}
    </section>
  );
}

export function StateFailure({
  description,
  onRetry,
}: {
  description: ReactNode;
  onRetry: () => void;
}) {
  return (
    <StateNotice
      role="alert"
      message={description}
      action={
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      }
    />
  );
}
