import { GitBranchIcon } from 'lucide-react';
import type { branchTracking } from '@porcelain/client/history/rules';
import { TruncatedText } from '@/shared/views/truncated-text';

export function BranchTracking({
  tracking,
}: {
  tracking: ReturnType<typeof branchTracking>;
}) {
  return (
    <div className="flex min-w-0 flex-1 items-start gap-2">
      <GitBranchIcon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex min-w-0 items-baseline gap-2">
          <TruncatedText
            className="min-w-0 flex-1 font-mono text-caption font-medium text-foreground"
            text={tracking.name}
          />
          {tracking.counts !== null && (
            <span className="shrink-0 text-2xs text-muted-foreground tabular-nums">
              {tracking.counts}
            </span>
          )}
        </div>
        <TruncatedText
          className="text-2xs text-muted-foreground"
          text={tracking.upstream}
        />
      </div>
    </div>
  );
}
