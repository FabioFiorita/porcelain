import type { ReactNode } from 'react';
import { CloudOffIcon, InfoIcon } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { Button } from '@/components/ui/button';
import { TruncatedText } from '@/shared/views/truncated-text';

export function StateFrame({
  navigation,
  title,
  children,
}: {
  navigation?: ReactNode;
  title: string;
  children: ReactNode;
}) {
  if (!navigation) return children;
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-paper border bg-background">
      <div className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
        {navigation}
        <span className="text-ui font-medium">{title}</span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">{children}</div>
    </div>
  );
}

export function StateNotice({
  title,
  description,
  icon,
  children,
  role,
}: {
  title: string;
  description?: ReactNode;
  icon?: ReactNode;
  children?: ReactNode;
  role?: 'alert' | 'status';
}) {
  return (
    <section
      data-slot="state-notice"
      role={role}
      className="flex w-full min-w-0 max-w-xl flex-col gap-3 p-6 text-left"
    >
      <div className="flex min-w-0 items-start gap-2">
        <span
          aria-hidden="true"
          className="mt-0.5 shrink-0 text-muted-foreground [&>svg]:size-4"
        >
          {icon ?? <InfoIcon />}
        </span>
        <TruncatedText
          text={title}
          render={<h2 />}
          className="text-base font-semibold"
        />
      </div>
      {description && (
        <div className="text-ui leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">
          {description}
        </div>
      )}
      {children && (
        <div className="flex flex-wrap items-center gap-2">{children}</div>
      )}
    </section>
  );
}

export function StateSkeleton({
  label,
  caption = true,
}: {
  label: string;
  caption?: boolean;
}) {
  return (
    <div
      role="status"
      aria-label={label}
      className="flex w-full min-w-0 flex-1 flex-col gap-3 bg-background p-6"
    >
      {caption && (
        <p className="flex items-center gap-2 text-ui text-muted-foreground">
          <Spinner aria-hidden="true" className="size-3.5" /> {label}…
        </p>
      )}
      <Skeleton className="h-5 w-2/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-4/5" />
      <Skeleton className="h-4 w-1/2" />
      {!caption && <span className="sr-only">{label}…</span>}
    </div>
  );
}

export function StateFailure({
  description,
  onRetry,
  onBack,
  title = 'Could not display',
}: {
  description: ReactNode;
  onRetry: () => void;
  onBack?: () => void;
  title?: string;
}) {
  return (
    <StateNotice
      role="alert"
      title={title}
      description={description}
      icon={<CloudOffIcon />}
    >
      <Button variant="outline" onClick={onRetry}>
        Try again
      </Button>
      {onBack && (
        <Button variant="ghost" onClick={onBack}>
          Back to workspace
        </Button>
      )}
    </StateNotice>
  );
}
