import type { ReactNode } from 'react';
import { cn } from 'cn';
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
  return (
    <div className="flex min-h-24 w-full flex-1 items-center justify-center p-6">
      <PendingSpinner label={label} />
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
