import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { StateSkeleton } from '@/shared/views/state-notice';

export function WorkspacePending() {
  return (
    <div
      role="status"
      aria-label="Loading environment"
      className="flex min-h-svh w-full gap-2 bg-muted p-2"
    >
      <div className="hidden w-66 shrink-0 flex-col gap-6 rounded-xl bg-sidebar p-4 md:flex">
        <span className="font-medium">Porcelain</span>
        {['first', 'second', 'third'].map((group) => (
          <div key={group} className="flex flex-col gap-3">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="ml-4 h-4 w-4/5" />
            <Skeleton className="ml-4 h-4 w-2/3" />
          </div>
        ))}
      </div>
      <div className="flex min-w-0 flex-1 flex-col rounded-xl border bg-card">
        <div className="flex h-12 items-center border-b px-4">
          <Skeleton className="h-7 w-16" />
        </div>
        <p className="flex items-center gap-2 px-6 pt-4 text-ui text-muted-foreground">
          <Spinner className="size-3.5" /> Loading environment…
        </p>
        <StateSkeleton label="Loading workspace" />
      </div>
    </div>
  );
}
