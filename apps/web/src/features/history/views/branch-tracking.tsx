import { GitBranchIcon } from 'lucide-react';
import type { branchTracking } from '@porcelain/client/history/rules';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/shared/lib/utils';

export function BranchTracking({
  tracking,
  focusable,
}: {
  tracking: ReturnType<typeof branchTracking>;
  focusable: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-1 items-start gap-2">
      <GitBranchIcon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex min-w-0 items-baseline gap-2">
          <FullText
            focusable={focusable}
            className="min-w-0 flex-1 font-mono text-caption font-medium text-foreground"
          >
            {tracking.name}
          </FullText>
          {tracking.counts !== null && (
            <span className="shrink-0 text-2xs text-muted-foreground tabular-nums">
              {tracking.counts}
            </span>
          )}
        </div>
        <FullText
          focusable={focusable}
          className="text-2xs text-muted-foreground"
        >
          {tracking.upstream}
        </FullText>
      </div>
    </div>
  );
}

function FullText({
  focusable,
  className,
  children,
}: {
  focusable: boolean;
  className: string;
  children: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            tabIndex={focusable ? 0 : undefined}
            className={cn('truncate', className)}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent className="break-all">{children}</TooltipContent>
    </Tooltip>
  );
}
