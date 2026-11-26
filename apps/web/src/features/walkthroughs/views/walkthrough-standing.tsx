import { useAtomValue } from '@effect/atom-react';
import { GitPullRequestIcon } from 'lucide-react';
import { readWalkthroughMergeReview } from '@porcelain/client/walkthroughs';
import {
  callDecisionProgress,
  type WalkthroughContent,
  type WalkthroughRun,
} from '@porcelain/client/walkthroughs/rules';
import {
  mergeReadiness,
  type MergeReadinessTone,
} from '@porcelain/client/projects/rules';
import {
  CheckResultIcon,
  type DocumentProps,
} from '@/features/workspace/index';
import { cn } from '@/shared/lib/utils';
import type { WalkthroughPull } from '../queries/pull';

const tones: Record<
  MergeReadinessTone,
  'passed' | 'failed' | 'running' | 'none'
> = {
  ready: 'passed',
  failed: 'failed',
  waiting: 'none',
  unknown: 'running',
  merged: 'passed',
  closed: 'none',
};

function stateWord(pull: NonNullable<WalkthroughPull>) {
  const detail = pull.status ?? pull.detail;
  if (!detail) return undefined;
  if (detail.state === 'open') return detail.draft ? 'Draft' : 'Open';
  return detail.state === 'merged' ? 'Merged' : 'Closed';
}

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
  const progress = callDecisionProgress(content, undefined);
  if (!pull && progress.total === 0) return null;
  const open =
    review && typeof review.undecidedCallStep === 'number'
      ? (review.undecidedCalls ?? 1)
      : 0;
  const readiness =
    pull && !pull.statusUnread
      ? mergeReadiness({
          status: pull.status,
          baseBranch: pull.detail?.baseBranch ?? 'the base branch',
          mergeMethods: pull.detail?.mergeMethods,
          review,
        })
      : undefined;
  const label =
    readiness?.label ??
    (open > 0 ? `${open === 1 ? '1 call' : `${open} calls`} open` : undefined);
  if (!label && !pull) return null;
  const tone = readiness ? tones[readiness.tone] : 'none';
  const ended = readiness?.tone === 'merged' || readiness?.tone === 'closed';
  const state = pull && !ended ? stateWord(pull) : undefined;
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
            readiness?.tone === 'unknown' &&
              'font-normal text-muted-foreground',
          )}
        >
          <span className="flex h-4.5 shrink-0 items-center">
            <CheckResultIcon tone={tone} />
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
