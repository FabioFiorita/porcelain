import type { ReactNode } from 'react';
import { useAtomSet, useAtomValue } from '@effect/atom-react';
import { cn } from 'cn';
import { pendingRegions } from '@/shared/store';
import { PENDING_GRACE_MS } from '@/config/limits';
import { Spinner } from '@/components/ui/spinner';
import { Button } from '@/components/ui/button';

export function PendingSpinner({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'pending-appear inline-flex text-muted-foreground',
        className,
      )}
    >
      <Spinner aria-label={label} />
    </span>
  );
}

export function StateSpinner({ label }: { label: string }) {
  const setRegions = useAtomSet(pendingRegions);
  return (
    <div
      className="min-h-24 w-full flex-1"
      ref={() => {
        setRegions((state) => ({
          labels: [...state.labels, label],
          idleSince: state.idleSince,
          episode:
            state.labels.length === 0 &&
            Date.now() - state.idleSince > PENDING_GRACE_MS
              ? state.episode + 1
              : state.episode,
        }));
        return () =>
          setRegions((state) => {
            const labels = state.labels.includes(label)
              ? state.labels.toSpliced(state.labels.indexOf(label), 1)
              : state.labels;
            return {
              labels,
              episode: state.episode,
              idleSince: labels.length === 0 ? Date.now() : state.idleSince,
            };
          });
      }}
    />
  );
}

export function PendingIndicator() {
  const { labels, episode } = useAtomValue(pendingRegions);
  const label = labels.at(-1);
  if (episode === 0) return null;
  return (
    <div
      key={episode}
      className={cn(
        'pointer-events-none fixed inset-0 grid place-items-center',
        label === undefined && 'invisible',
      )}
    >
      <PendingSpinner label={label ?? 'Opening'} />
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
