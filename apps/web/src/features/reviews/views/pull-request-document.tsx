import { useAtomRefresh, useAtomValue } from '@effect/atom-react';
import { useNavigate } from '@tanstack/react-router';
import { Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { createPortal } from 'react-dom';
import {
  ArrowLeftIcon,
  ArrowUpRightIcon,
  CheckIcon,
  CircleCheckIcon,
  CircleXIcon,
  CopyIcon,
  FileCodeIcon,
  GitPullRequestIcon,
  LoaderCircleIcon,
  LockKeyholeIcon,
  SettingsIcon,
  TriangleAlertIcon,
} from 'lucide-react';
import { readReviewPullRequest } from '@porcelain/client/reviews';
import type { PullRequestRead } from '@porcelain/client/reviews/rules';
import {
  githubUnavailable,
  pullCheckDuration,
  pullCheckTone,
  pullRequestChecks,
  pullRequestMergeable,
  pullRequestRepository,
  pullReviewState,
} from '@porcelain/client/reviews/rules';
import { shortOid } from '@porcelain/client/history/rules';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { MarkdownView } from '@/features/files/index';
import { relativeTime } from '@/shared/lib/relative-time';
import { cn } from '@/shared/lib/utils';
import {
  StateFailure,
  StateNotice,
  StateSkeleton,
} from '@/shared/views/state-notice';
import { TruncatedText } from '@/shared/views/truncated-text';
import type { ConnectionContext } from '@/shared/workspace/connection';
import { copyText } from '@/shared/workspace/copy';
import {
  ChecksStatus,
  Dot,
  PullStatePill,
  UnavailablePill,
} from './pull-request-parts';

type PullRequest = Extract<
  PullRequestRead,
  { kind: 'available' }
>['pullRequest'];
type TimelineItem = PullRequest['timeline'][number];

type Props = {
  reviewId: string;
  number: number;
  context: ConnectionContext;
  toolbarTarget?: HTMLElement | null | undefined;
  onBack: () => void;
  onFile?: ((path: string) => void) | undefined;
};

export function PullRequestDocument({
  reviewId,
  number,
  context,
  toolbarTarget,
  onBack,
  onFile,
}: Props) {
  const query = readReviewPullRequest({
    connection: context.connection,
    reviewId,
  });
  const result = useAtomValue(query);
  const retry = useAtomRefresh(query);
  const value = Option.getOrUndefined(AsyncResult.value(result));
  if (AsyncResult.isFailure(result))
    return (
      <StateFailure
        description="The pull request could not be read."
        onRetry={retry}
        onBack={onBack}
      />
    );
  if (!value) return <StateSkeleton label="Loading pull request" />;
  if (value.kind === 'unavailable')
    return (
      <UnavailablePullRequest
        reason={value.reason}
        retrying={result.waiting}
        onRetry={retry}
        onBack={onBack}
      />
    );
  if (value.kind === 'not-linked' || value.pullRequest.number !== number)
    return (
      <StateNotice
        title={
          value.kind === 'not-linked'
            ? 'Pull request no longer linked'
            : 'This review follows another pull request'
        }
        description="Return to the review to see its current pull request."
      >
        <Button variant="outline" onClick={onBack}>
          Back to the review
        </Button>
      </StateNotice>
    );
  const pull = value.pullRequest;
  return (
    <div className="@container/pr flex min-h-0 min-w-0 flex-1 flex-col overflow-auto">
      <PullRequestActions url={pull.url} target={toolbarTarget} />
      <article
        aria-busy={result.waiting}
        aria-label={`Pull request #${number}`}
        className="mx-auto w-full max-w-280 min-w-0 px-4 pt-9 pb-12 @min-3xl/pr:px-7"
      >
        <PullRequestHeader pull={pull} />
        <div className="mt-7 flex min-w-0 flex-col gap-x-11 gap-y-7 @min-4xl/pr:flex-row">
          <div className="min-w-0 flex-1">
            <section aria-label="Description">
              <div className={sectionHeading}>
                <h2>Description</h2>
                {pull.author && (
                  <TruncatedText
                    text={`by ${pull.author}`}
                    className="ml-auto font-normal"
                  />
                )}
              </div>
              {pull.description.trim() ? (
                <MarkdownView
                  text={pull.description}
                  className="pt-3.5 text-(length:--text-prose) leading-6 wrap-anywhere text-foreground-2 [&_h1]:text-foreground [&_h2]:text-foreground [&_h3]:text-base [&_h3]:leading-6 [&_h3]:text-foreground [&_code]:text-ui [&_code]:leading-5 [&_p]:leading-6 [&_p]:mt-1 [&_p]:mb-0 [&_ul]:mt-2 [&_ul]:mb-0 [&_ol]:mt-2 [&_ol]:mb-0 [&_li]:my-0 [&_h1]:mb-0 [&_h2]:mb-0 [&_h3]:mb-0 [&_h1]:tracking-pr-subheading [&_h2]:tracking-pr-subheading [&_h3]:tracking-pr-subheading [&_code]:rounded-sm [&_code]:px-1.25 [&_code]:py-px [&_code]:ring-1 [&_code]:ring-border [&_code]:ring-inset"
                />
              ) : (
                <p className="pt-3.5 text-ui text-muted-foreground">
                  No description provided.
                </p>
              )}
            </section>
            <PullRequestConversation
              pull={pull}
              onBack={onBack}
              onFile={onFile}
            />
          </div>
          <aside
            aria-label="Checks and details"
            className="min-w-0 shrink-0 @min-4xl/pr:w-68"
          >
            <PullRequestChecks pull={pull} />
          </aside>
        </div>
      </article>
    </div>
  );
}

const sectionHeading =
  'flex min-h-6 min-w-0 flex-wrap items-center gap-x-2 gap-y-1 border-b pb-1.5 text-xs leading-4 font-medium text-muted-foreground';

function PullRequestActions({
  url,
  target,
}: {
  url: string;
  target: Props['toolbarTarget'];
}) {
  const action = (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            nativeButton={false}
            render={<a href={url} target="_blank" rel="noreferrer" />}
            aria-label="Open on GitHub"
            className=""
          />
        }
      >
        <span
          className={cn(target !== undefined && 'hidden @min-3xl/pane:inline')}
        >
          Open on GitHub
        </span>
        <ArrowUpRightIcon aria-hidden="true" className="size-3.5" />
      </TooltipTrigger>
      <TooltipContent>Open on GitHub</TooltipContent>
    </Tooltip>
  );
  if (target !== undefined) return target ? createPortal(action, target) : null;
  return (
    <div className="flex h-12 shrink-0 items-center justify-end border-b px-3">
      {action}
    </div>
  );
}

function PullRequestHeader({ pull }: { pull: PullRequest }) {
  const repository = pullRequestRepository(pull.url)?.split('/').at(-1);
  return (
    <header className="min-w-0">
      <div className="flex h-5.5 min-w-0 items-center gap-2 text-ui leading-5.5 font-medium text-muted-foreground">
        <GitPullRequestIcon
          aria-hidden="true"
          strokeWidth={1.75}
          className="size-3.5 shrink-0"
        />
        <span className="shrink-0">Pull request</span>
        {repository && (
          <>
            <Dot />
            <TruncatedText text={repository} />
          </>
        )}
      </div>
      <TruncatedText
        text={`#${pull.number} ${pull.title}`}
        render={<h1 />}
        className="mt-3 block text-4xl leading-10 font-semibold tracking-pr-title"
      >
        <span className="text-title-dim tabular-nums">#{pull.number}</span>{' '}
        {pull.title}
      </TruncatedText>
      <div className="mt-3.5 flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-2 text-ui leading-5 text-muted-foreground">
        <PullStatePill pull={pull} />
        {pull.author && (
          <>
            <span
              aria-hidden="true"
              className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-foreground text-2xs leading-none font-semibold text-background"
            >
              {pull.author.slice(0, 1).toUpperCase()}
            </span>
            <TruncatedText
              text={pull.author}
              className="font-medium text-foreground"
            />
            <Dot />
          </>
        )}
        <Tooltip>
          <TooltipTrigger
            render={
              <span
                tabIndex={0}
                className="inline-flex max-w-full min-w-0 items-center gap-1.5 font-mono text-caption text-foreground outline-none"
              />
            }
          >
            <TruncatedText text={pull.baseBranch} />
            <ArrowLeftIcon
              aria-hidden="true"
              strokeWidth={1.75}
              className="size-3 shrink-0 text-muted-foreground"
            />
            <TruncatedText text={pull.headBranch} />
          </TooltipTrigger>
          <TooltipContent>
            Merges {pull.headBranch} into {pull.baseBranch}
          </TooltipContent>
        </Tooltip>
        <Dot />
        <span>updated {timeAgo(pull.updatedAt)}</span>
        {pull.matchesReviewHead ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <span
                  tabIndex={0}
                  className="inline-flex items-center gap-1.5 text-foreground outline-none @min-4xl/pr:ml-auto"
                />
              }
            >
              <CheckIcon
                aria-hidden="true"
                strokeWidth={2.25}
                className="size-3.5 text-add-fg"
              />
              Same head as the review
            </TooltipTrigger>
            <TooltipContent>
              The pull request’s head, {shortOid(pull.headSha)}, is the commit
              this review reads
            </TooltipContent>
          </Tooltip>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-warn @min-4xl/pr:ml-auto">
            <TriangleAlertIcon aria-hidden="true" className="size-3.5" />
            Different head from the review
          </span>
        )}
      </div>
      {pull.labels.length > 0 && (
        <ul aria-label="Labels" className="mt-3 flex min-w-0 flex-wrap gap-1.5">
          {pull.labels.map((label, index) => (
            <li key={`${label.name}:${index}`} className="min-w-0 max-w-full">
              <Badge variant="outline" className="max-w-full">
                <TruncatedText text={label.name} />
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </header>
  );
}

function PullRequestConversation({
  pull,
  onBack,
  onFile,
}: {
  pull: PullRequest;
  onBack: () => void;
  onFile: Props['onFile'];
}) {
  return (
    <section aria-label="Conversation on GitHub" className="mt-7 min-w-0">
      <div className={sectionHeading}>
        <h2>Conversation</h2>
        <span className="font-normal tabular-nums">{pull.timeline.length}</span>
        <a
          href={`${pull.url}#issuecomment-new`}
          target="_blank"
          rel="noreferrer"
          className="ml-auto inline-flex max-w-full min-w-0 flex-wrap items-center gap-1 font-normal outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <LockKeyholeIcon aria-hidden="true" className="size-3 shrink-0" />
          <span>
            Comments on GitHub ·{' '}
            <span className="font-medium text-foreground">reply there</span>
          </span>
          <ArrowUpRightIcon aria-hidden="true" className="size-3 shrink-0" />
        </a>
      </div>
      {pull.timeline.length > 0 ? (
        <ol
          aria-label="Timeline"
          className="relative mt-3.5 flex min-w-0 flex-col gap-4 before:absolute before:top-4 before:bottom-2.5 before:left-2.5 before:w-px before:bg-border"
        >
          {pull.timeline.map((item) => (
            <PullRequestTimelineItem
              key={item.id}
              item={item}
              onFile={onFile}
            />
          ))}
        </ol>
      ) : (
        <p className="pt-3.5 text-ui text-muted-foreground">
          No comments or reviews on GitHub yet.
        </p>
      )}
      {pull.truncated && (
        <p className="mt-3 text-xs text-muted-foreground">
          Some labels or conversation items are not shown. Open on GitHub to see
          everything.
        </p>
      )}
      <p className="mt-4 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-xs leading-4 text-muted-foreground @min-3xl/pr:ml-7.5">
        Comments to the agent stay in the review.
        <Button variant="link" size="sm" onClick={onBack}>
          Back to the review
        </Button>
      </p>
    </section>
  );
}

function PullRequestTimelineItem({
  item,
  onFile,
}: {
  item: TimelineItem;
  onFile: Props['onFile'];
}) {
  const review = pullReviewState(item.reviewState);
  const author = item.author ?? 'Unknown author';
  const line = item.line ?? item.originalLine;
  const path = item.path;
  const file =
    item.path === undefined
      ? undefined
      : `${item.path}${line === undefined ? '' : `:${line}`}`;
  return (
    <li className="relative flex min-w-0 items-start gap-2.5">
      <span
        aria-hidden="true"
        className="z-1 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-foreground text-2xs leading-none font-semibold text-background ring-3 ring-background"
      >
        {author.slice(0, 1).toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex min-h-5 min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs leading-4 text-muted-foreground">
          <TruncatedText
            text={author}
            className="text-ui leading-4.5 font-semibold text-foreground"
          />
          {review && (
            <Badge
              variant={review.tone === 'failed' ? 'destructive' : 'outline'}
            >
              {review.label}
            </Badge>
          )}
          <span>
            {!review && item.kind === 'comment' ? 'commented · ' : ''}
            {timeAgo(item.time)}
          </span>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  nativeButton={false}
                  render={
                    <a href={item.url} target="_blank" rel="noreferrer" />
                  }
                  aria-label={`Open this ${item.kind === 'review' ? 'review' : 'comment'} on GitHub`}
                  className="ml-auto size-5.5"
                />
              }
            >
              <ArrowUpRightIcon aria-hidden="true" className="size-3" />
            </TooltipTrigger>
            <TooltipContent>Open on GitHub</TooltipContent>
          </Tooltip>
        </div>
        {file && (
          <div className="mt-2.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 rounded-t-lg border bg-muted px-2 py-1.5">
            {onFile && item.path !== undefined ? (
              <Button
                variant="ghost"
                size="sm"
                aria-label={`Open ${file}`}
                className="max-w-full min-w-0 justify-start"
                onClick={() => {
                  if (path !== undefined) onFile(path);
                }}
              >
                <FileCodeIcon
                  aria-hidden="true"
                  className="size-3.5 text-muted-foreground"
                />
                <TruncatedText text={file} />
              </Button>
            ) : (
              <span className="flex min-w-0 items-center gap-1.5 font-mono text-xs">
                <FileCodeIcon
                  aria-hidden="true"
                  className="size-3.5 shrink-0 text-muted-foreground"
                />
                <TruncatedText text={file} />
              </span>
            )}
            <span className="ml-auto text-xs text-muted-foreground">
              review comment
            </span>
          </div>
        )}
        {item.body.trim() && (
          <MarkdownView
            text={item.body}
            className={cn(
              'mt-1 text-sm leading-5.5 wrap-anywhere [&_p]:my-0 [&_p]:leading-5.5',
              file &&
                'mt-0 rounded-b-lg border border-t-0 px-3 py-2.5 text-ui [&_p]:leading-4.75',
            )}
          />
        )}
      </div>
    </li>
  );
}

const checkDisplay = {
  passed: { Icon: CircleCheckIcon, label: 'Passed', color: 'text-add-fg' },
  failed: { Icon: CircleXIcon, label: 'Failed', color: 'text-del-fg' },
  running: {
    Icon: LoaderCircleIcon,
    label: 'Running',
    color: 'text-muted-foreground',
  },
};

function PullRequestChecks({ pull }: { pull: PullRequest }) {
  const checks = pullRequestChecks(
    pull.checks,
    pull.checksTruncated,
    pull.checksSummary,
  );
  const mergeable = pullRequestMergeable(pull.mergeable);
  return (
    <>
      <section aria-label="GitHub checks">
        <div className={sectionHeading}>
          <h2>Checks</h2>
          <ChecksStatus
            tone={checks.tone}
            label={
              checks.tone === 'passed'
                ? `${pull.checks.length}${pull.checksTruncated ? '+' : ''} passed`
                : checks.label
            }
            className="ml-auto text-foreground tabular-nums"
          />
        </div>
        {pull.checks.length === 0 ? (
          <p className="pt-3 text-ui text-muted-foreground">
            No checks reported by GitHub.
          </p>
        ) : (
          <ul className="mt-1" aria-label="Pull request checks">
            {pull.checks.map((check, index) => {
              const tone = pullCheckTone(check);
              const duration = pullCheckDuration(check.durationMs);
              const display = checkDisplay[tone];
              const Icon = display.Icon;
              return (
                <li
                  key={`${check.name}:${index}`}
                  className="flex h-7 min-w-0 items-center gap-2 text-ui leading-4.5"
                >
                  <Icon
                    role="img"
                    aria-label={display.label}
                    className={cn('size-3.5 shrink-0', display.color)}
                  />
                  <TruncatedText text={check.name} className="min-w-0 flex-1" />
                  {duration && (
                    <span className="shrink-0 text-xs leading-4 text-muted-foreground tabular-nums">
                      {duration}
                    </span>
                  )}
                  {check.detailsUrl && (
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <a
                            href={check.detailsUrl}
                            target="_blank"
                            rel="noreferrer"
                            aria-label={`Details for ${check.name} on GitHub`}
                            className="inline-flex h-5.5 shrink-0 items-center gap-0.75 rounded-sm pr-1 pl-1.5 text-xs leading-5.5 font-medium text-muted-foreground outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
                          />
                        }
                      >
                        Details
                        <ArrowUpRightIcon
                          aria-hidden="true"
                          className="size-2.75"
                        />
                      </TooltipTrigger>
                      <TooltipContent>
                        Details for {check.name} on GitHub
                      </TooltipContent>
                    </Tooltip>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {pull.checksTruncated && (
          <p className="mt-2 text-xs text-muted-foreground">
            More checks are available on GitHub.
          </p>
        )}
      </section>
      <dl aria-label="Merge" className="mt-5 border-y text-ui leading-4.5">
        <div className="flex h-7 min-w-0 items-center gap-2">
          <dt className="text-muted-foreground">Head</dt>
          <dd className="ml-auto min-w-0 font-mono text-caption font-medium">
            <TruncatedText text={pull.headSha} disclose="always">
              {shortOid(pull.headSha)}
            </TruncatedText>
          </dd>
        </div>
        <div className="flex h-7 items-center gap-2 border-t">
          <dt className="text-muted-foreground">Mergeable</dt>
          <dd className="ml-auto font-medium">
            <ChecksStatus
              tone={mergeable.tone}
              label={mergeable.label}
              className="gap-1.5"
            />
          </dd>
        </div>
      </dl>
    </>
  );
}

function UnavailablePullRequest({
  reason,
  retrying,
  onRetry,
  onBack,
}: {
  reason: Extract<PullRequestRead, { kind: 'unavailable' }>['reason'];
  retrying: boolean;
  onRetry: () => void;
  onBack: () => void;
}) {
  const navigate = useNavigate();
  const { description, action } = githubUnavailable(reason);
  return (
    <StateNotice title="Pull request unavailable" description={description}>
      <UnavailablePill />
      {action.kind === 'settings' && (
        <Button
          variant="outline"
          onClick={() =>
            void navigate({
              to: '/settings/$section',
              params: { section: 'git' },
            })
          }
        >
          <SettingsIcon />
          {action.label}
        </Button>
      )}
      {action.kind === 'install' && (
        <Button
          variant="outline"
          nativeButton={false}
          render={<a href={action.url} target="_blank" rel="noreferrer" />}
        >
          <ArrowUpRightIcon />
          {action.label}
        </Button>
      )}
      {action.kind === 'copy' && (
        <Button
          variant="outline"
          onClick={() => copyText(action.text, 'command')}
        >
          <CopyIcon />
          {action.label}
        </Button>
      )}
      {(action.kind === 'retry' || action.kind === 'copy') && (
        <Button variant="outline" disabled={retrying} onClick={onRetry}>
          Try again
        </Button>
      )}
      <Button variant="ghost" onClick={onBack}>
        Back to the review
      </Button>
    </StateNotice>
  );
}

function timeAgo(time: string) {
  return Number.isFinite(Date.parse(time))
    ? relativeTime(time)
    : 'unknown time';
}
