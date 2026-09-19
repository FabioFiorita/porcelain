import { Skeleton } from '@/components/ui/skeleton';

export function WorkspacePending() {
  return (
    <div className="grid h-svh grid-cols-[264px_1fr_320px] gap-2 bg-muted p-2">
      <Skeleton className="rounded-xl" />
      <Skeleton className="rounded-xl" />
      <Skeleton className="rounded-xl" />
    </div>
  );
}
