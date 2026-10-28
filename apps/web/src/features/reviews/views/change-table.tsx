import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { TruncatedText } from '@/shared/views/truncated-text';
import { type ReactNode, useState } from 'react';
import type {
  ReviewChangeItem,
  ReviewScope,
} from '@porcelain/client/reviews/rules';
import { type ConnectionContext } from '@/shared/workspace/connection';
import type { CodeHeaderControls } from './code-document';
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
  return (
    <section aria-label={label} className="pb-4.25">
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
                aria-label={`File review actions: ${reviewed} of ${items.length} ${items.length === 1 ? 'file' : 'files'} reviewed`}
              />
            }
          >
            {reviewed} of {items.length} {items.length === 1 ? 'file' : 'files'}{' '}
            reviewed
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
              className="flex h-8 items-center gap-3 border-b pl-1"
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
              <RowTarget
                current={controls.current === item.path}
                onOpen={counts ? () => controls.open(item.path) : undefined}
              >
                <TruncatedText
                  className="min-w-0 font-mono text-caption leading-4"
                  text={item.path}
                >
                  <span className="text-muted-foreground">
                    {item.path.slice(0, slash)}
                  </span>
                  {item.path.slice(slash)}
                </TruncatedText>
                {counts && (
                  <span className="ml-auto shrink-0 font-mono text-xs leading-4 font-medium tabular-nums">
                    <span className="text-del-fg">−{counts.deletions}</span>{' '}
                    <span className="text-add-fg">+{counts.additions}</span>
                  </span>
                )}
              </RowTarget>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function RowTarget({
  current,
  onOpen,
  children,
}: {
  current: boolean;
  onOpen: (() => void) | undefined;
  children: ReactNode;
}) {
  const className =
    'flex h-8 min-w-0 flex-1 items-center gap-3 rounded-sm px-1.5 text-left whitespace-nowrap text-foreground';
  if (!onOpen) return <div className={className}>{children}</div>;
  return (
    <button
      type="button"
      aria-current={current ? 'true' : undefined}
      onClick={onOpen}
      className={`${className} outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring`}
    >
      {children}
    </button>
  );
}
