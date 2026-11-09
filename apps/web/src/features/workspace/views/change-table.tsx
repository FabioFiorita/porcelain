import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { TruncatedText } from '@/shared/views/truncated-text';
import { type ReactNode, useState } from 'react';
import {
  counted,
  type ReviewChangeItem,
  type ReviewScope,
} from '@porcelain/client/reviews/rules';
import { type ConnectionContext } from '@/shared/workspace/connection';
import type { CodeHeaderControls } from './code-document';
import { ChangeCounts } from './change-counts';
import { ReviewedCheckbox } from './reviewed-control';

export function ChangeTable({
  scope,
  context,
  label,
  items,
  controls,
  actions,
  actionsOpen,
  onActionsOpenChange,
}: {
  scope: ReviewScope;
  context: ConnectionContext;
  label: string;
  items: readonly ReviewChangeItem[];
  controls: CodeHeaderControls;
  actions?: ReactNode;
  actionsOpen: boolean;
  onActionsOpenChange: (open: boolean) => void;
}) {
  const [latest, setLatest] = useState<string>();
  const reviewed = items.filter(
    (item) => item.reviewStatus === 'reviewed',
  ).length;
  const progress = `${reviewed} of ${counted(items.length, 'file')} reviewed`;
  return (
    <section aria-label={label} className="pb-3.25">
      <div className="flex min-h-6 flex-wrap items-center gap-x-3.5 gap-y-1 border-b pb-1.5 text-xs text-muted-foreground tabular-nums">
        <h2 className="text-ui leading-4 font-medium text-foreground">
          {label}
        </h2>
        <Popover open={actionsOpen} onOpenChange={onActionsOpenChange}>
          <PopoverTrigger
            render={
              <Button
                type="button"
                size="xs"
                variant="ghost"
                className="ml-auto"
                aria-label={`File review actions: ${progress}`}
              />
            }
          >
            {progress}
          </PopoverTrigger>
          <PopoverContent aria-label="File review actions" align="end">
            {controls.collapse}
            {actions}
          </PopoverContent>
        </Popover>
      </div>
      <ol>
        {items.map((item) => {
          const slash = item.path.lastIndexOf('/') + 1;
          const counts = controls.counts.get(item.path);
          return (
            <li
              key={item.path}
              className="box-content flex h-8 items-center gap-3 border-t pl-1 first:border-t-0 last:border-b"
            >
              <ReviewedCheckbox
                scope={scope}
                context={context}
                path={item.path}
                fingerprint={item.fingerprint}
                status={item.reviewStatus}
                latest={latest === item.path}
                onStart={() => setLatest(item.path)}
              />
              <TruncatedText
                text={item.path}
                renderTrigger={(_label, clip) => (
                  <button
                    type="button"
                    aria-label={`${item.path}${counts ? ` +${counts.additions} −${counts.deletions}` : ''}`}
                    aria-current={
                      controls.current === item.path ? 'true' : undefined
                    }
                    onClick={() => controls.open(item.path)}
                    className="flex h-8 min-w-0 flex-1 items-center gap-3 rounded-sm px-1.5 text-left whitespace-nowrap text-foreground outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="flex min-w-0 font-mono text-caption leading-4">
                      {slash > 0 &&
                        clip(
                          item.path.slice(0, slash),
                          'shrink-[100] text-muted-foreground',
                          'start',
                        )}
                      {clip(item.path.slice(slash), 'shrink-0 max-w-full')}
                    </span>
                    {counts && (
                      <span className="ml-auto shrink-0">
                        <ChangeCounts counts={counts} />
                      </span>
                    )}
                  </button>
                )}
              />
            </li>
          );
        })}
      </ol>
    </section>
  );
}
