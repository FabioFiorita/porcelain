import { useAtom, useAtomRefresh, useAtomValue } from '@effect/atom-react';
import { useNavigate } from '@tanstack/react-router';
import { Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { createPortal, flushSync } from 'react-dom';
import { useState, type ReactNode } from 'react';
import { File } from '@pierre/diffs/react';
import {
  ArrowLeftIcon,
  ArrowUpRightIcon,
  FileCodeIcon,
  GitPullRequestIcon,
  SettingsIcon,
} from 'lucide-react';
import { ArchivePullRequest } from '@/features/projects/index';
import { readProjectPullRequest } from '@porcelain/client/projects';
import type { PullRequestRead } from '@porcelain/client/projects/rules';
import {
  githubUnavailable,
  pullRequestBlockers,
  pullRequestConversation,
  pullRequestRepository,
  pullReviewState,
  undecidedCallAtHead,
  type PullRequestRerunTarget,
} from '@porcelain/client/projects/rules';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useTheme } from '@/features/preferences/index';
import { PIERRE_THEME, PIERRE_HIGHLIGHTER } from '@/shared/lib/pierre';
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
  StateSpinner,
} from '@/shared/views/state-notice';
import { TruncatedText } from '@/shared/views/truncated-text';
import type { ConnectionContext } from '@/shared/workspace/connection';
import type { DocumentRef } from '../rules/documents';
import { Dot, PullStatePill } from './pull-request-parts';
import {
  checkRowSelector,
  PullRequestChecks,
  sectionHeading,
} from './pull-request-checks';
import { PullRequestDecision } from './pull-request-decision';
import { PullRequestComposer } from './pull-request-composer';
import { readWalkthroughMergeReview } from '@porcelain/client/walkthroughs';
import { PullRequestReviewNotes } from './pull-request-review-notes';
import { pullRequestCheckFocus } from '../store';
import { PublishReviewButton } from '@/features/comments/index';
import { useRerunChecks } from '../commands/pull-request-actions';
import {
  useBranchStanding,
  usePullRequestStatus,
} from '../queries/pull-request-status';

type PullRequest = Extract<
  PullRequestRead,
  { kind: 'available' }
>['pullRequest'];
type TimelineItem = PullRequest['timeline'][number];

type Props = {
  projectId: string;
  number: number;
  context: ConnectionContext;
  toolbarTarget?: HTMLElement | null | undefined;
  onBack: () => void;
  onFile?: ((path: string) => void) | undefined;
  checkout?: { projectId: string; worktreeId: string } | undefined;
  onOpen?: ((document: DocumentRef) => void) | undefined;
};

const reviewStateBadges = {
  passed: 'open',
  failed: 'closed',
  none: 'outline',
} as const;

export function PullRequestDocument({
  projectId,
  number,
  context,
  toolbarTarget,
  onBack,
  onFile,
  checkout,
  onOpen,
}: Props) {
  const query = readProjectPullRequest({
    connection: context.connection,
    projectId,
    number,
  });
  const result = useAtomValue(query);
  const retry = useAtomRefresh(query);
  const value = Option.getOrUndefined(AsyncResult.value(result));
  if (AsyncResult.isFailure(result))
    return (
      <StateFailure
        description="The pull request could not be read."
        onRetry={retry}
      />
    );
  if (!value) return <StateSpinner label="Reading the pull request" />;
  if (value.kind === 'unavailable')
    return (
      <UnavailablePullRequest
        reason={value.reason}
        retrying={result.waiting}
        onRetry={retry}
      />
    );
  const pull = value.pullRequest;
  return (
    <div className="@container/pr flex min-h-0 min-w-0 flex-1 flex-col overflow-auto">
      <PullRequestActions
        url={pull.url}
        target={toolbarTarget}
        archive={
          pull.state === 'merged' || pull.state === 'closed' ? (
            <ArchivePullRequest
              context={context}
              projectId={projectId}
              number={number}
            />
          ) : undefined
        }
      />
      <article
        aria-busy={result.waiting}
        aria-label={`Pull request #${number}`}
        className="mx-auto w-full max-w-280 min-w-0 px-4 pt-9 pb-12 text-ui @min-3xl/pr:px-7"
      >
        <PullRequestHeader pull={pull} />
        <PullRequestLive
          pull={pull}
          context={context}
          projectId={projectId}
          number={number}
          checkout={checkout}
          onOpen={onOpen}
        />
        <section aria-label="Description" className="mt-8 min-w-0">
          <div className={sectionHeading}>
            <h2>Description</h2>
            <div className="ml-auto flex min-w-0 items-center gap-1.5 font-normal">
              {pull.author && <TruncatedText text={`by ${pull.author}`} />}
              {pull.author && pull.createdAt && <Dot />}
              {pull.createdAt && (
                <time dateTime={pull.createdAt}>{timeAgo(pull.createdAt)}</time>
              )}
            </div>
          </div>
          {pull.description.trim() ? (
            <MarkdownView
              text={pull.description}
              className="pt-3 text-(length:--text-prose) leading-6 wrap-anywhere text-foreground-2 [&_h1]:text-foreground [&_h2]:text-foreground [&_h3]:text-base [&_h3]:leading-6 [&_h3]:text-foreground [&_code]:text-ui [&_code]:leading-5 [&_p]:leading-6 [&_p]:mt-1 [&_p]:mb-0 [&_ul]:mt-2 [&_ul]:mb-0 [&_ol]:mt-2 [&_ol]:mb-0 [&_li]:my-0 [&_h1]:mb-0 [&_h2]:mb-0 [&_h3]:mb-0 [&_h1]:tracking-pr-subheading [&_h2]:tracking-pr-subheading [&_h3]:tracking-pr-subheading [&_code]:rounded-sm [&_code]:px-1.25 [&_code]:py-px [&_code]:ring-1 [&_code]:ring-border [&_code]:ring-inset"
            />
          ) : (
            <p className="pt-3 text-ui text-muted-foreground">
              No description provided.
            </p>
          )}
        </section>
        <PullRequestConversation
          pull={pull}
          context={context}
          projectId={projectId}
          checkout={checkout}
          onBack={onBack}
          onFile={onFile}
        />
      </article>
    </div>
  );
}

function PullRequestActions({
  url,
  target,
  archive,
}: {
  archive: ReactNode;
  url: string;
  target: Props['toolbarTarget'];
}) {
  const action = (
    <>
      {archive}
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="sm"
              render={<a href={url} target="_blank" rel="noreferrer" />}
              aria-label="Open on GitHub"
              className=""
            />
          }
        >
          <span
            className={cn(
              target !== undefined && 'hidden @min-3xl/pane:inline',
            )}
          >
            Open on GitHub
          </span>
          <ArrowUpRightIcon aria-hidden="true" className="size-3.5" />
        </TooltipTrigger>
        <TooltipContent>Open on GitHub</TooltipContent>
      </Tooltip>
    </>
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
      <h1 className="mt-3 text-4xl leading-10 font-semibold tracking-pr-title wrap-anywhere">
        <span className="text-title-dim tabular-nums">#{pull.number}</span>{' '}
        {pull.title}
      </h1>
      <div className="mt-3.5 flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-2 text-ui leading-5 text-muted-foreground">
        <PullStatePill pull={pull} />
        {pull.author && (
          <>
            <GitHubAuthorAvatar
              author={pull.author}
              url={pull.authorAvatarUrl}
            />
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
  context,
  projectId,
  checkout,
  onBack,
  onFile,
}: {
  pull: PullRequest;
  context: ConnectionContext;
  projectId: string;
  checkout: Props['checkout'];
  onBack: () => void;
  onFile: Props['onFile'];
}) {
  const conversation = pullRequestConversation(pull.timeline);
  return (
    <section aria-label="Conversation on GitHub" className="mt-8 min-w-0">
      <div className={sectionHeading}>
        <h2>Conversation</h2>
        <span className="font-normal tabular-nums">{pull.timeline.length}</span>
        <a
          href={pull.url}
          target="_blank"
          rel="noreferrer"
          className="ml-auto inline-flex max-w-full min-w-0 items-center gap-1 font-normal outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          On GitHub
          <ArrowUpRightIcon aria-hidden="true" className="size-3 shrink-0" />
        </a>
      </div>
      {conversation.length > 0 ? (
        <ol
          aria-label="Timeline"
          className={cn(
            'relative mt-3 flex min-w-0 flex-col gap-4',
            conversation.length > 1 &&
              'before:absolute before:top-4 before:bottom-2.5 before:left-2.5 before:w-px before:bg-border',
          )}
        >
          {conversation.map(({ item, comments }) => (
            <PullRequestTimelineItem key={item.id} item={item} onFile={onFile}>
              {comments.length > 0 && (
                <ol
                  aria-label={`Comments on review by ${item.author ?? 'Unknown author'}`}
                  className="mt-3 flex min-w-0 flex-col gap-3 border-l pl-3"
                >
                  {comments.map((comment) => (
                    <PullRequestTimelineItem
                      key={comment.id}
                      item={comment}
                      onFile={onFile}
                    />
                  ))}
                </ol>
              )}
            </PullRequestTimelineItem>
          ))}
        </ol>
      ) : (
        <p className="pt-3 text-ui text-muted-foreground">
          No comments or reviews on GitHub yet.
        </p>
      )}
      <PullRequestComposer
        context={context}
        projectId={projectId}
        number={pull.number}
        reviewAction={
          checkout && (
            <PublishReviewButton owner={{ scope: checkout, context }} />
          )
        }
      />
      {pull.truncated && (
        <p className="mt-3 text-xs text-muted-foreground">
          Some labels or conversation items are not shown. Open on GitHub to see
          everything.
        </p>
      )}
      <p className="mt-4 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-xs leading-4 text-muted-foreground @min-3xl/pr:ml-7.5">
        Questions about the change belong in its Walkthrough.
        <Button variant="link" size="sm" onClick={onBack}>
          Back to the worktree
        </Button>
      </p>
    </section>
  );
}

function GitHubAuthorAvatar({
  author,
  url,
}: {
  author: string;
  url: string | undefined;
}) {
  return (
    <Avatar size="sm" aria-hidden="true">
      {url && <AvatarImage src={url} alt="" />}
      <AvatarFallback>{author.slice(0, 1).toUpperCase()}</AvatarFallback>
    </Avatar>
  );
}

function PullRequestTimelineItem({
  item,
  onFile,
  children,
}: {
  item: TimelineItem;
  onFile: Props['onFile'];
  children?: ReactNode;
}) {
  const { dark } = useTheme();
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
      <div className="z-1 shrink-0 bg-background">
        <GitHubAuthorAvatar author={author} url={item.authorAvatarUrl} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex min-h-5 min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs leading-4 text-muted-foreground">
          <TruncatedText
            text={author}
            className="text-ui leading-4.5 font-semibold text-foreground"
          />
          {review && (
            <Badge variant={reviewStateBadges[review.tone]}>
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
                  render={
                    <a href={item.url} target="_blank" rel="noreferrer" />
                  }
                  aria-label={`Open this ${item.kind === 'review' ? 'review' : 'comment'} on GitHub`}
                  className="ml-auto"
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
                <FileCodeIcon aria-hidden="true" />
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
        {item.diffHunk && (
          <div
            role="region"
            aria-label={`Code excerpt for ${path ?? 'review comment'}`}
            className="max-h-64 min-w-0 overflow-auto border-x"
          >
            <File
              file={{
                name: path ?? 'review.diff',
                contents: item.diffHunk,
                lang: 'diff',
              }}
              options={{
                theme: PIERRE_THEME,
                preferredHighlighter: PIERRE_HIGHLIGHTER,
                themeType: dark ? 'dark' : 'light',
                disableFileHeader: true,
                disableLineNumbers: true,
                overflow: 'wrap',
              }}
            />
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
        {children}
      </div>
    </li>
  );
}

function UnavailablePullRequest({
  reason,
  retrying,
  onRetry,
}: {
  reason: Extract<PullRequestRead, { kind: 'unavailable' }>['reason'];
  retrying: boolean;
  onRetry: () => void;
}) {
  const navigate = useNavigate();
  const { description, action } = githubUnavailable(reason);
  let button = (
    <Button variant="outline" disabled={retrying} onClick={onRetry}>
      Try again
    </Button>
  );
  if (action.kind === 'settings')
    button = (
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
    );
  if (action.kind === 'install')
    button = (
      <Button
        variant="outline"
        render={<a href={action.url} target="_blank" rel="noreferrer" />}
      >
        <ArrowUpRightIcon />
        {action.label}
      </Button>
    );
  return <StateNotice role="alert" message={description} action={button} />;
}

function timeAgo(time: string) {
  return Number.isFinite(Date.parse(time))
    ? relativeTime(time)
    : 'unknown time';
}

function PullRequestLive({
  pull,
  context,
  projectId,
  number,
  checkout,
  onOpen,
}: {
  pull: PullRequest;
  context: ConnectionContext;
  projectId: string;
  number: number;
  checkout: Props['checkout'];
  onOpen: Props['onOpen'];
}) {
  const { connection } = context;
  const { status, problem, reading, refresh, pendingReruns } =
    usePullRequestStatus(connection, projectId, number);
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set());
  const toggle = (key: string, value?: boolean) =>
    setOpen((current) => {
      const next = new Set(current);
      if (value ?? !next.has(key)) next.add(key);
      else next.delete(key);
      return next;
    });
  const focusCheck = (key: string) => {
    const check = status?.checks.find((entry) => entry.key === key);
    flushSync(() =>
      setOpen((current) => {
        const next = new Set(current);
        next.add(key);
        if (check?.kind === 'actions' && check.runId !== undefined)
          next.add(`passed:run:${check.runId}`);
        return next;
      }),
    );
    const row = document.querySelector<HTMLElement>(checkRowSelector(key));
    row?.scrollIntoView({ block: 'center' });
    row?.focus();
  };
  const [focusTarget, setFocusTarget] = useAtom(pullRequestCheckFocus);
  const focused =
    status &&
    focusTarget?.projectId === projectId &&
    focusTarget.number === number
      ? status.checks.find((check) => check.name === focusTarget.name)
      : undefined;
  const rerun = useRerunChecks(connection, projectId, number);
  const onRerun = (target: PullRequestRerunTarget, keys: readonly string[]) => {
    if (status) void rerun.rerun(status, target, keys);
  };
  const standing = useBranchStanding(connection, checkout);
  const review = useAtomValue(
    readWalkthroughMergeReview(
      checkout && standing.walkthrough
        ? { connection, scope: checkout, ...standing.walkthrough }
        : undefined,
    ),
  );
  const headSha = status?.headSha ?? pull.headSha;
  const call = undecidedCallAtHead(review, headSha);
  const blockers = status ? pullRequestBlockers(status, pull.baseBranch) : [];
  const openStep = onOpen
    ? (step: number) => onOpen({ kind: 'walkthrough-step', step })
    : undefined;
  return (
    <>
      {focused && (
        <span
          hidden
          ref={(element) => {
            if (element)
              queueMicrotask(() => {
                setFocusTarget(undefined);
                focusCheck(focused.key);
              });
          }}
        />
      )}
      <PullRequestDecision
        pull={pull}
        status={status}
        context={context}
        projectId={projectId}
        blockers={blockers}
        walkthrough={
          standing.walkthroughHead && onOpen
            ? {
                headOid: standing.walkthroughHead,
                onOpen: () => onOpen({ kind: 'review' }),
              }
            : undefined
        }
        review={review}
        changedSinceReview={standing.changedSinceReview}
        notes={
          checkout && (
            <PullRequestReviewNotes
              checkout={checkout}
              context={context}
              undecidedCallStep={call}
              onOpenStep={openStep}
            />
          )
        }
        onOpenFile={
          onOpen ? (path) => onOpen({ kind: 'branch-file', path }) : undefined
        }
        onFocusCheck={focusCheck}
      />
      {status && problem && (
        <ChecksProblem
          problem={problem}
          reading={reading}
          onRetry={refresh}
          stale
        />
      )}
      {status ? (
        <PullRequestChecks
          status={status}
          connection={connection}
          projectId={projectId}
          number={number}
          controller={{ open, toggle }}
          pendingReruns={pendingReruns}
          rerunning={rerun.pending}
          onRerun={onRerun}
          citations={standing.citations}
          onOpenStep={openStep}
        />
      ) : (
        <section aria-label="Checks" className="mt-8 min-w-0">
          <div className={sectionHeading}>
            <h2>Checks</h2>
          </div>
          {problem && (
            <ChecksProblem
              problem={problem}
              reading={reading}
              onRetry={refresh}
              stale={false}
            />
          )}
        </section>
      )}
    </>
  );
}

function ChecksProblem({
  problem,
  reading,
  onRetry,
  stale,
}: {
  problem: NonNullable<ReturnType<typeof usePullRequestStatus>['problem']>;
  reading: boolean;
  onRetry: () => void;
  stale: boolean;
}) {
  const reason =
    problem === 'failed'
      ? 'The checks could not be read.'
      : githubUnavailable(problem).description;
  return (
    <p
      role="status"
      className="mt-3 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-ui text-muted-foreground"
    >
      <span className="min-w-0">
        {stale ? `Showing the last read. ${reason}` : reason}
      </span>
      <Button variant="outline" size="sm" disabled={reading} onClick={onRetry}>
        Try again
      </Button>
    </p>
  );
}
