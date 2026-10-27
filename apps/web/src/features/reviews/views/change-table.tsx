import { TruncatedText } from '@/shared/views/truncated-text';
import type { ReactNode } from 'react';
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
}: {
  scope: ReviewScope;
  context: ConnectionContext;
  label: string;
  items: readonly ReviewChangeItem[];
  controls: CodeHeaderControls;
  actions?: ReactNode;
}) {
  const reviewed = items.filter(
    (item) => item.reviewStatus === 'reviewed',
  ).length;
  return (
    <section aria-label={label} className="pb-4.25">
      <div className="flex min-h-6 flex-wrap items-center gap-x-3.5 gap-y-1 border-b pb-1.5 text-xs text-muted-foreground tabular-nums">
        <h2 className="text-ui leading-4 font-medium text-foreground">
          {label}
        </h2>
        <span className="ml-auto">
          {reviewed} of {items.length} {items.length === 1 ? 'file' : 'files'}{' '}
          reviewed
        </span>
        {(controls.collapse || actions) && (
          <span className="flex items-center gap-1">
            {controls.collapse}
            {actions}
          </span>
        )}
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
              />
              <button
                type="button"
                aria-current={
                  controls.current === item.path ? 'true' : undefined
                }
                onClick={() => controls.open(item.path)}
                className="flex h-8 min-w-0 flex-1 items-center gap-3 rounded-sm px-1.5 text-left whitespace-nowrap text-foreground outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
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
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
