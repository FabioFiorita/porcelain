import { Skeleton } from '../../components/ui/skeleton';

export function WorkspacePending() {
  return (
    <div
      role="status"
      aria-label="Loading environment"
      className="flex w-full flex-col gap-3"
    >
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}
