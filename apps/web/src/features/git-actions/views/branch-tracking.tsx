import { GitBranchIcon } from 'lucide-react';
import { branchTracking } from '@porcelain/client/history/rules';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export function BranchTracking({
  branch,
}: {
  branch: Parameters<typeof branchTracking>[0] | null;
}) {
  const tracking = branchTracking(branch ?? undefined, null);
  return (
    <div className="flex min-w-0 flex-1 items-start gap-2">
      <GitBranchIcon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex min-w-0 items-baseline gap-2">
          <Tooltip>
            <TooltipTrigger
              render={
                <span
                  tabIndex={0}
                  className="min-w-0 flex-1 truncate font-medium"
                />
              }
            >
              {tracking.name}
            </TooltipTrigger>
            <TooltipContent className="break-all">
              {tracking.name}
            </TooltipContent>
          </Tooltip>
          {tracking.counts !== null && (
            <span className="shrink-0 text-muted-foreground tabular-nums">
              {tracking.counts}
            </span>
          )}
        </div>
        <Tooltip>
          <TooltipTrigger
            render={
              <span tabIndex={0} className="truncate text-muted-foreground" />
            }
          >
            {tracking.upstream}
          </TooltipTrigger>
          <TooltipContent className="break-all">
            {tracking.upstream}
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
