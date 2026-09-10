import { Skeleton } from '../../components/ui/skeleton';

export function WorkspacePending() {
  return (
    <div
      role="status"
      aria-label="Loading environment"
      className="flex min-h-svh w-full"
    >
      <div className="hidden w-80 shrink-0 flex-col gap-6 border-r bg-sidebar p-6 md:flex">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-16 w-full" />
        {[0, 1, 2].map((group) => (
          <div key={group} className="flex flex-col gap-3">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="ml-4 h-12 w-52" />
            <Skeleton className="ml-4 h-12 w-44" />
          </div>
        ))}
      </div>
      <div className="flex flex-1 flex-col gap-4 p-8">
        <p className="text-sm text-muted-foreground">Loading environment…</p>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-60" />
      </div>
    </div>
  );
}
