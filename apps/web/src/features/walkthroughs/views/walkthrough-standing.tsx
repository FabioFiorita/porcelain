import { useAtomValue } from '@effect/atom-react';
import { GitPullRequestIcon } from 'lucide-react';
import { readWalkthroughMergeReview } from '@porcelain/client/walkthroughs';
import type {
  WalkthroughContent,
  WalkthroughRun,
} from '@porcelain/client/walkthroughs/rules';
import { walkthroughStanding } from '@porcelain/client/projects/rules';
import {
  CheckResultIcon,
  type DocumentProps,
} from '@/features/workspace/index';
import { cn } from '@/shared/lib/utils';
import type { WalkthroughPull } from '../queries/pull';

export function WalkthroughStanding({
  document,
  run,
  content,
  pull,
}: {
  document: DocumentProps;
  run: WalkthroughRun;
  content: WalkthroughContent;
  pull: WalkthroughPull;
}) {
  const review = useAtomValue(
    readWalkthroughMergeReview({
      connection: document.context.connection,
      scope: document.scope,
      runId: run.id,
      headOid: run.headOid,
      content,
    }),
  );
  const standing = walkthroughStanding({ pull, review });
  if (!standing) return null;
  const { label, icon, quiet, pullState: state } = standing;
  return (
    <div
      role="status"
      aria-label="Merge status"
      className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5"
    >
      {label && (
        <p
          className={cn(
            'flex min-w-0 items-start gap-2 text-ui font-medium text-pretty',
            quiet && 'font-normal text-muted-foreground',
          )}
        >
          <span className="flex h-4.5 shrink-0 items-center">
            <CheckResultIcon tone={icon} />
          </span>
          <span className="min-w-0">{label}</span>
        </p>
      )}
      {pull && (
        <button
          type="button"
          onClick={() => pull.openCheck(undefined)}
          className="flex h-6 shrink-0 items-center gap-1.5 rounded-md border px-2 text-caption text-foreground-2 hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
        >
          <GitPullRequestIcon aria-hidden className="size-3.5" />
          <span className="font-medium tabular-nums">#{pull.number}</span>
          {state && <span className="text-muted-foreground">{state}</span>}
          <span className="sr-only">, open the pull request</span>
        </button>
      )}
    </div>
  );
}
