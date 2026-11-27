import { GitBranchIcon } from 'lucide-react';
import type { branchTracking } from '@porcelain/client/history/rules';
import { TruncatedText } from '@/shared/views/truncated-text';
import { cn } from '@/shared/lib/utils';

export function BranchTracking({
  tracking,
  title = false,
}: {
  tracking: ReturnType<typeof branchTracking>;
  title?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-1 items-start gap-2">
      <GitBranchIcon
        className={cn(
          'shrink-0 text-muted-foreground',
          title ? 'mt-0.5 size-4' : 'mt-0.5 size-3.5',
        )}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex min-w-0 items-baseline gap-2">
          <TruncatedText
            className={cn(
              'min-w-0 font-mono text-foreground',
              title
                ? 'text-sm leading-5 font-semibold'
                : 'text-caption font-medium',
            )}
            text={tracking.name}
            {...(title ? { render: <h1 /> } : {})}
          />
          {tracking.counts !== null && (
            <span className="shrink-0 text-2xs text-muted-foreground tabular-nums">
              {tracking.counts}
            </span>
          )}
        </div>
        <TruncatedText
          className={cn(
            'text-muted-foreground',
            title ? 'text-caption' : 'text-2xs',
          )}
          text={tracking.upstream}
        />
      </div>
    </div>
  );
}
