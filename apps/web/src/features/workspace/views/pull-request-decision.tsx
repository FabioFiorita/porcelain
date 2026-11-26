import type { ReactNode } from 'react';
import { FileDiffIcon } from 'lucide-react';
import {
  pullRequestMergeable,
  withPullRequestStatus,
  type PullRequestMergeReview,
  type MergeBlocker,
  type PullRequestRead,
  type PullStatus,
} from '@porcelain/client/projects/rules';
import { shortOid } from '@porcelain/client/history/rules';
import { MergePullRequest } from '@/features/projects/index';
import { Button } from '@/components/ui/button';
import { TruncatedText } from '@/shared/views/truncated-text';
import type { ConnectionContext } from '@/shared/workspace/connection';
import { cn } from '@/shared/lib/utils';
import { StateIcon, sectionHeading } from './pull-request-checks';
import { Dot } from './pull-request-parts';

const blockerStates = {
  failed: 'failed',
  running: 'running',
  none: 'pending',
} as const;

type PullRequest = Extract<
  PullRequestRead,
  { kind: 'available' }
>['pullRequest'];

export type WalkthroughStanding = {
  readonly headOid: string;
  readonly onOpen: () => void;
};

export function DecisionNote({
  children,
  action,
}: {
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <li className="flex min-h-7 min-w-0 items-center gap-2 text-ui leading-4.5">
      <StateIcon state="pending" />
      <span className="min-w-0 py-1 wrap-anywhere">{children}</span>
      {action}
    </li>
  );
}

export function PullRequestDecision({
  pull,
  status,
  context,
  projectId,
  blockers,
  walkthrough,
  changedSinceReview,
  review,
  notes,
  onOpenFile,
  onFocusCheck,
}: {
  notes?: ReactNode;
  pull: PullRequest;
  status: PullStatus | undefined;
  context: ConnectionContext;
  projectId: string;
  blockers: readonly MergeBlocker[];
  walkthrough: WalkthroughStanding | undefined;
  review: PullRequestMergeReview | undefined;
  changedSinceReview: readonly string[];
  onOpenFile: ((path: string) => void) | undefined;
  onFocusCheck: (key: string) => void;
}) {
  const live = withPullRequestStatus(pull, status);
  const mergeable = pullRequestMergeable(live.mergeable);
  const staleWalkthrough =
    walkthrough !== undefined && walkthrough.headOid !== live.headSha;
  const open = live.state === 'open';
  return (
    <section aria-labelledby="pull-decision-heading" className="mt-7 min-w-0">
      <div className={sectionHeading}>
        <h2 id="pull-decision-heading">Merge</h2>
        <span className="ml-auto flex min-w-0 items-center gap-1.5 font-normal">
          <span>{mergeable.label}</span>
          <Dot />
          <span className="font-mono text-caption text-foreground">
            {shortOid(live.headSha)}
          </span>
        </span>
      </div>
      {open && (
        <ul aria-label="What blocks the merge" className="min-w-0 pt-1">
          {blockers.map((blocker) => (
            <li
              key={blocker.key}
              className="flex min-h-7 min-w-0 items-center gap-2 text-ui leading-4.5"
            >
              <StateIcon state={blockerStates[blocker.tone]} />
              {blocker.checkKey ? (
                <button
                  type="button"
                  onClick={() => onFocusCheck(blocker.checkKey ?? '')}
                  className="min-w-0 rounded-sm py-1 text-left wrap-anywhere underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {blocker.text}
                </button>
              ) : (
                <span className="min-w-0 py-1 wrap-anywhere">
                  {blocker.text}
                </span>
              )}
            </li>
          ))}
          {blockers.length === 0 && status && (
            <li className="flex h-7 min-w-0 items-center gap-2 text-ui">
              <StateIcon state="passed" />
              <span>Nothing on GitHub blocks the merge.</span>
            </li>
          )}
          {staleWalkthrough && (
            <li className="flex min-h-7 min-w-0 items-center gap-2 text-ui leading-4.5">
              <StateIcon state="pending" />
              <span className="min-w-0">
                The Walkthrough covers{' '}
                <span className="font-mono text-caption">
                  {shortOid(walkthrough.headOid)}
                </span>
                ; the pull request is at{' '}
                <span className="font-mono text-caption">
                  {shortOid(live.headSha)}
                </span>
                .
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="shrink-0"
                onClick={walkthrough.onOpen}
              >
                Open Walkthrough
              </Button>
            </li>
          )}
          {notes}
        </ul>
      )}
      {changedSinceReview.length > 0 && (
        <div className="min-w-0 pt-1">
          <p className="flex h-7 min-w-0 items-center gap-2 text-ui leading-4.5">
            <StateIcon state="pending" />
            {changedSinceReview.length}{' '}
            {changedSinceReview.length === 1
              ? 'file you marked reviewed has'
              : 'files you marked reviewed have'}{' '}
            changed since.
          </p>
          <ul
            aria-label="Reviewed files that changed"
            className="flex min-w-0 flex-col pl-5.5"
          >
            {changedSinceReview.slice(0, 8).map((path) => (
              <li key={path} className="min-w-0">
                {onOpenFile ? (
                  <button
                    type="button"
                    className="flex h-6 max-w-full min-w-0 items-center gap-1.5 rounded-sm font-mono text-xs text-foreground-2 underline-offset-2 outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => onOpenFile(path)}
                  >
                    <FileDiffIcon
                      aria-hidden="true"
                      className="size-3.5 shrink-0 text-muted-foreground"
                    />
                    <TruncatedText text={path} />
                  </button>
                ) : (
                  <TruncatedText
                    text={path}
                    className="font-mono text-xs text-muted-foreground"
                  />
                )}
              </li>
            ))}
          </ul>
          {changedSinceReview.length > 8 && (
            <p className="pl-5.5 text-xs text-muted-foreground">
              and {changedSinceReview.length - 8} more
            </p>
          )}
        </div>
      )}
      {open && (
        <MergePullRequest
          context={context}
          projectId={projectId}
          pull={live}
          review={review}
          showBlock={
            status === undefined ||
            review?.undecidedCallStep === 'reading' ||
            review?.undecidedCallStep === 'unreadable'
          }
          className={cn('mt-2 border-t pt-3')}
        />
      )}
    </section>
  );
}
