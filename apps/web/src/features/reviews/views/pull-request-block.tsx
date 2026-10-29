import { useState, type ReactNode } from 'react';
import type { PullRequestRead } from '@porcelain/client/reviews/rules';
import { usePullRequestLinkFocus } from '../store';
import { cn } from '@/shared/lib/utils';
import { useAtom, useAtomRefresh, useAtomValue } from '@effect/atom-react';
import { useNavigate } from '@tanstack/react-router';
import { Cause, Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import {
  ArrowUpRightIcon,
  CopyIcon,
  EllipsisIcon,
  LinkIcon,
  RefreshCwIcon,
  SettingsIcon,
  TriangleAlertIcon,
  UnlinkIcon,
} from 'lucide-react';
import {
  readReview,
  readReviewPullRequest,
  readProjectPullRequests,
  readProjectGitHubAccount,
  reviewCommands,
} from '@porcelain/client/reviews';
import {
  foundPullRequests,
  githubUnavailable,
  pullRequestBlockHidden,
  pullRequestChecks,
  pullRequestLink,
  pullRequestNumber,
  pullRequestRepository,
  pullRequestRollup,
  reviewErrorMessage,
  reviewListTitle,
  type FoundPullRequest,
} from '@porcelain/client/reviews/rules';
import { shortOid } from '@porcelain/client/history/rules';
import type { ConnectionContext } from '@/shared/workspace/connection';
import { copyText } from '@/shared/workspace/copy';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { TruncatedText } from '@/shared/views/truncated-text';
import {
  ChecksStatus,
  Dot,
  PullStatePill,
  UnavailablePill,
  pullStateIcon,
} from './pull-request-parts';

type Props = {
  reviewId: string;
  context: ConnectionContext;
  onOpenPullRequest?: ((number: number) => void) | undefined;
};
type FocusReturn = 'linked' | 'unlinked' | undefined;

function returnFocusTo(
  element: HTMLElement | null,
  target: FocusReturn,
  pending: FocusReturn,
  done: () => void,
) {
  if (!element || pending !== target || element.matches(':disabled')) return;
  done();
  if (document.activeElement === document.body) element.focus();
}

export function PullRequestBlock({
  reviewId,
  context,
  onOpenPullRequest,
}: Props) {
  const linkFocus = usePullRequestLinkFocus(reviewId);
  const input = { connection: context.connection, reviewId };
  const recordQuery = readReview(input);
  const record = useAtomValue(recordQuery);
  const refreshRecord = useAtomRefresh(recordQuery);
  const pullQuery = readReviewPullRequest(input);
  const result = useAtomValue(pullQuery);
  const refresh = useAtomRefresh(pullQuery);
  const [mutation, setPullRequest] = useAtom(
    reviewCommands(input).setPullRequest,
  );
  const [focusReturn, setFocusReturn] = useState<FocusReturn>();
  const data = Option.getOrUndefined(AsyncResult.value(record));
  const pull = AsyncResult.isFailure(result)
    ? { kind: 'failed' as const }
    : Option.getOrUndefined(AsyncResult.value(result));
  const linked = data?.review?.pullRequest;
  const answer = Option.getOrUndefined(AsyncResult.value(mutation));
  const writeSettledWithoutChange =
    focusReturn !== undefined &&
    !mutation.waiting &&
    (AsyncResult.isFailure(mutation) || answer?.kind === 'unavailable');
  const currentControl: FocusReturn = linked ? 'linked' : 'unlinked';
  const focusTarget = writeSettledWithoutChange ? currentControl : focusReturn;
  const outcome = (
    <>
      {AsyncResult.isFailure(mutation) && (
        <Alert variant="destructive" className="mt-2">
          <AlertDescription>
            {reviewErrorMessage(Cause.squash(mutation.cause))}
          </AlertDescription>
        </Alert>
      )}
      {answer?.kind === 'unavailable' && (
        <Alert className="mt-2">
          <AlertDescription>
            {githubUnavailable(answer.reason).description} Try again after
            GitHub is available.
          </AlertDescription>
        </Alert>
      )}
    </>
  );
  if (!AsyncResult.isFailure(record) && data?.review && !linked)
    return (
      <PullRequestDiscovery
        context={context}
        reviewId={reviewId}
        projectId={data.review.projectId}
        branch={data.review.branch}
        pending={mutation.waiting}
        outcome={outcome}
        inputRef={(element) => {
          returnFocusTo(element, 'unlinked', focusTarget, () =>
            setFocusReturn(undefined),
          );
          linkFocus.attach(element);
        }}
        onLink={(pullRequest) => {
          setFocusReturn('linked');
          setPullRequest({ pullRequest });
        }}
      />
    );
  const number = linked ? pullRequestNumber(linked) : undefined;
  const closedReview = data?.review?.state === 'closed';
  return (
    <PullRequestSection
      trailing={
        linked && (
          <>
            <GitHubLink url={linked} number={number} />
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <DropdownMenuTrigger
                      render={
                        <Button
                          ref={(element) =>
                            returnFocusTo(element, 'linked', focusTarget, () =>
                              setFocusReturn(undefined),
                            )
                          }
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Pull request actions"
                          disabled={mutation.waiting}
                        />
                      }
                    >
                      <EllipsisIcon />
                    </DropdownMenuTrigger>
                  }
                />
                <TooltipContent>Pull request actions</TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="end" className="w-59">
                <DropdownMenuItem
                  render={<a href={linked} target="_blank" rel="noreferrer" />}
                >
                  <ArrowUpRightIcon />
                  Open on GitHub
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => copyText(linked, 'pull request link')}
                >
                  <CopyIcon />
                  Copy link
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="items-start"
                  onClick={() => {
                    setFocusReturn('unlinked');
                    setPullRequest({ pullRequest: undefined });
                  }}
                >
                  <UnlinkIcon className="mt-0.5" />
                  <span className="flex min-w-0 flex-col">
                    <span>Unlink {number ? `#${number}` : 'pull request'}</span>
                    <span className="text-muted-foreground">
                      {closedReview
                        ? 'The review stays closed and readable under Closed.'
                        : 'The review stays and follows its branch again.'}
                    </span>
                  </span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )
      }
    >
      {AsyncResult.isFailure(record) && (
        <Alert variant="destructive" className="mt-1">
          <AlertDescription>
            Could not display this review.
            <Button variant="outline" size="xs" onClick={refreshRecord}>
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      )}
      {!AsyncResult.isFailure(record) && !data?.review && (
        <Skeleton className="mt-1 h-8 w-full" />
      )}
      {mutation.waiting && linked && (
        <p role="status" className="mt-1 text-xs text-muted-foreground">
          Unlinking…
        </p>
      )}
      {!AsyncResult.isFailure(record) && data?.review && linked && (
        <LinkedPullRequest
          url={linked}
          number={number}
          pull={pull}
          reviewHead={data.revision?.headOid}
          retrying={result.waiting}
          onRetry={refresh}
          onOpen={onOpenPullRequest}
        />
      )}
      {outcome}
    </PullRequestSection>
  );
}

type PullAnswer = PullRequestRead | { kind: 'failed' } | undefined;

function LinkedPullRequest({
  url,
  number,
  pull,
  reviewHead,
  retrying,
  onRetry,
  onOpen,
}: {
  url: string;
  number: number | undefined;
  pull: PullAnswer;
  reviewHead: string | undefined;
  retrying: boolean;
  onRetry: () => void;
  onOpen: ((number: number) => void) | undefined;
}) {
  if (pull?.kind === 'available')
    return (
      <LinkedState pull={pull.pullRequest} reviewHead={reviewHead}>
        <OpenPullRequest url={url} number={number} onOpen={onOpen} />
      </LinkedState>
    );
  return (
    <>
      <PullTitle
        number={number}
        title={
          <TruncatedText
            text={pullRequestRepository(url) ?? url}
            className="font-mono text-xs leading-4.5 text-muted-foreground"
          />
        }
      />
      {pull === undefined || pull.kind === 'not-linked' ? (
        <p role="status" className="mt-2 text-xs text-muted-foreground">
          Reading pull request…
        </p>
      ) : (
        <PullUnavailable
          reason={pull.kind === 'unavailable' ? pull.reason : undefined}
          retrying={retrying}
          onRetry={onRetry}
        />
      )}
    </>
  );
}

function LinkedState({
  pull,
  reviewHead,
  children,
}: {
  pull: {
    number: number;
    title: string;
    state: 'open' | 'closed' | 'merged';
    draft: boolean;
    baseBranch: string;
    headSha: string;
    matchesReviewHead: boolean;
    checks: Parameters<typeof pullRequestChecks>[0];
    checksTruncated: boolean;
    checksSummary?: string | undefined;
  };
  reviewHead: string | undefined;
  children: ReactNode;
}) {
  const checks = pullRequestChecks(
    pull.checks,
    pull.checksTruncated,
    pull.checksSummary,
  );
  const newer = pull.state === 'open' && !pull.matchesReviewHead;
  return (
    <>
      <PullTitle number={pull.number} title={pull.title} />
      <StateLine>
        <PullStatePill pull={pull} />
        {pull.state === 'merged' && (
          <>
            <span>
              into <span className="font-mono">{pull.baseBranch}</span>
            </span>
            <Dot />
          </>
        )}
        {pull.state === 'closed' ? (
          <span>not merged</span>
        ) : (
          <ChecksStatus tone={checks.tone} label={checks.label} />
        )}
        {pull.state === 'open' && pull.matchesReviewHead && (
          <>
            <Dot />
            <Tooltip>
              <TooltipTrigger
                render={<span tabIndex={0} className="outline-none" />}
              >
                Same head
              </TooltipTrigger>
              <TooltipContent>
                The pull request’s head, {shortOid(pull.headSha)}, is the commit
                this review reads
              </TooltipContent>
            </Tooltip>
          </>
        )}
      </StateLine>
      {newer && (
        <p className="mt-2 flex items-start gap-1.5 text-xs leading-4.25 font-medium text-warn">
          <TriangleAlertIcon
            aria-hidden="true"
            className="mt-0.5 size-3 shrink-0"
          />
          <span className="min-w-0">
            GitHub has commits newer than this review.
            <span className="block font-mono font-normal wrap-anywhere text-muted-foreground">
              PR at {shortOid(pull.headSha)} · review read{' '}
              {reviewHead ? shortOid(reviewHead) : 'unknown'}
            </span>
          </span>
        </p>
      )}
      {pull.state !== 'open' && (
        <p className="mt-2 text-xs leading-4.25 text-muted-foreground">
          {pull.state === 'merged'
            ? `This review closed when #${pull.number} merged. It stays readable under Closed.`
            : 'This review closed with the pull request. It stays readable under Closed.'}
        </p>
      )}
      {children}
    </>
  );
}

function OpenPullRequest({
  url,
  number,
  onOpen,
}: {
  url: string;
  number: number | undefined;
  onOpen: ((number: number) => void) | undefined;
}) {
  const content = (
    <>
      <GitPullRequestGlyph />
      Open pull request
    </>
  );
  return onOpen && number !== undefined ? (
    <Button
      variant="outline"
      className={wideButton}
      onClick={() => onOpen(number)}
    >
      {content}
    </Button>
  ) : (
    <Button
      variant="outline"
      className={wideButton}
      nativeButton={false}
      render={<a href={url} target="_blank" rel="noreferrer" />}
    >
      {content}
    </Button>
  );
}

function GitPullRequestGlyph() {
  const Icon = pullStateIcon({ state: 'open', draft: false });
  return <Icon aria-hidden="true" className="text-muted-foreground" />;
}

const wideButton = 'mt-2.5 w-full';

function PullUnavailable({
  reason,
  retrying,
  onRetry,
}: {
  reason: Parameters<typeof githubUnavailable>[0] | undefined;
  retrying: boolean;
  onRetry: () => void;
}) {
  const navigate = useNavigate();
  const copy = reason
    ? githubUnavailable(reason)
    : {
        description: 'Porcelain could not read the pull request.',
        action: { kind: 'retry', label: 'Try again' } as const,
      };
  const { action } = copy;
  return (
    <>
      <StateLine>
        <UnavailablePill />
      </StateLine>
      <p className="mt-2 text-xs leading-4.25 text-foreground-2">
        {copy.description}
      </p>
      {action.kind === 'settings' && (
        <Button
          variant="outline"
          className={cn(wideButton, 'mt-2')}
          onClick={() =>
            void navigate({
              to: '/settings/$section',
              params: { section: 'git' },
            })
          }
        >
          <SettingsIcon
            aria-hidden="true"
            strokeWidth={1.75}
            className="size-3.5 text-muted-foreground"
          />
          {action.label}
        </Button>
      )}
      {action.kind === 'install' && (
        <Button
          variant="outline"
          className={cn(wideButton, 'mt-2')}
          nativeButton={false}
          render={<a href={action.url} target="_blank" rel="noreferrer" />}
        >
          <ArrowUpRightIcon
            aria-hidden="true"
            className="size-3.5 text-muted-foreground"
          />
          {action.label}
        </Button>
      )}
      {action.kind === 'copy' && (
        <Button
          variant="outline"
          className={cn(wideButton, 'mt-2')}
          onClick={() => copyText(action.text, 'command')}
        >
          <CopyIcon
            aria-hidden="true"
            className="size-3.5 text-muted-foreground"
          />
          {action.label}
        </Button>
      )}
      {(action.kind === 'retry' || action.kind === 'copy') && (
        <Button
          variant={action.kind === 'retry' ? 'outline' : 'ghost'}
          className={cn(wideButton, 'mt-2')}
          disabled={retrying}
          onClick={onRetry}
        >
          <RefreshCwIcon
            aria-hidden="true"
            className="size-3.5 text-muted-foreground"
          />
          Try again
        </Button>
      )}
    </>
  );
}

function PullTitle({
  number,
  title,
}: {
  number: number | undefined;
  title: ReactNode;
}) {
  return (
    <div className="mt-1 flex min-w-0 items-baseline gap-1.5 text-ui leading-4.5 whitespace-nowrap">
      {number !== undefined && (
        <span className="shrink-0 font-medium text-muted-foreground tabular-nums">
          #{number}
        </span>
      )}
      {typeof title === 'string' ? (
        <TruncatedText text={title} className="min-w-0 font-semibold" />
      ) : (
        title
      )}
    </div>
  );
}

function StateLine({ children }: { children: ReactNode }) {
  return (
    <div className="mt-2 flex min-h-5 min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs leading-4 whitespace-nowrap text-muted-foreground tabular-nums">
      {children}
    </div>
  );
}

function GitHubLink({
  url,
  number,
}: {
  url: string;
  number: number | undefined;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto"
            nativeButton={false}
            render={<a href={url} target="_blank" rel="noreferrer" />}
          />
        }
      >
        On GitHub
        <ArrowUpRightIcon aria-hidden="true" />
      </TooltipTrigger>
      <TooltipContent>
        Open {number ? `#${number}` : 'the pull request'} on github.com
      </TooltipContent>
    </Tooltip>
  );
}

function PullRequestSection({
  trailing,
  children,
}: {
  trailing?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      aria-label="Pull request"
      className="mx-2.5 mt-3 mb-3 flex max-h-96 min-w-0 shrink-0 flex-col overflow-y-auto border-b px-1 pb-3"
    >
      <div className="flex h-6 shrink-0 items-center gap-0.5">
        <h3 className="text-xs leading-6 font-medium text-muted-foreground">
          Pull request
        </h3>
        {trailing}
      </div>
      {children}
    </section>
  );
}

function FoundPull({
  pull,
  heldBy,
  context,
  pending,
  onLink,
}: {
  pull: FoundPullRequest;
  heldBy: string | undefined;
  context: ConnectionContext;
  pending: boolean;
  onLink: (url: string) => void;
}) {
  const rollup = pullRequestRollup(pull.checksSummary);
  return (
    <div className="flex min-w-0 flex-col">
      <PullTitle number={pull.number} title={pull.title} />
      <StateLine>
        <PullStatePill pull={pull} />
        <ChecksStatus tone={rollup.tone} label={rollup.label} />
        {pull.author && (
          <>
            <Dot />
            <TruncatedText text={pull.author} className="min-w-0" />
          </>
        )}
      </StateLine>
      {heldBy ? (
        <HeldElsewhere
          reviewId={heldBy}
          number={pull.number}
          context={context}
        />
      ) : (
        <>
          <p className="mt-2 text-xs leading-4.25 text-muted-foreground">
            GitHub has it for this branch. Link it so the review follows it.
          </p>
          <Button
            className="mt-2.5 w-full"
            disabled={pending}
            onClick={() => onLink(pull.url)}
          >
            <LinkIcon aria-hidden="true" className="size-3.5" />
            Link to this review
          </Button>
        </>
      )}
    </div>
  );
}

function HeldElsewhere({
  reviewId,
  number,
  context,
}: {
  reviewId: string;
  number: number;
  context: ConnectionContext;
}) {
  const holder = Option.getOrUndefined(
    AsyncResult.value(
      useAtomValue(readReview({ connection: context.connection, reviewId })),
    ),
  );
  const title = holder?.review
    ? reviewListTitle(holder.review, holder.revision ?? undefined, undefined)
    : undefined;
  return (
    <p className="mt-2 text-xs leading-4.25 wrap-anywhere text-foreground-2">
      #{number} is already linked to{' '}
      {title ? (
        <>
          the open review “<span className="font-medium">{title}</span>”
        </>
      ) : (
        `review ${reviewId}`
      )}
      . Unlink it there from the Pull request menu, then link it here.
    </p>
  );
}

function PullRequestDiscovery({
  context,
  reviewId,
  projectId,
  branch,
  pending,
  outcome,
  inputRef,
  onLink,
}: {
  context: ConnectionContext;
  reviewId: string;
  projectId: string;
  branch: string;
  pending: boolean;
  outcome: ReactNode;
  inputRef: (element: HTMLInputElement | null) => void;
  onLink: (url: string) => void;
}) {
  const accountResult = useAtomValue(
    readProjectGitHubAccount({ connection: context.connection, projectId }),
  );
  const repository = AsyncResult.isFailure(accountResult)
    ? undefined
    : Option.getOrUndefined(AsyncResult.value(accountResult))?.repository;
  const [url, setUrl] = useState('');
  const [malformed, setMalformed] = useState(false);
  const [outcomeStale, setOutcomeStale] = useState(false);
  const submit = (pullRequest: string) => {
    setOutcomeStale(false);
    onLink(pullRequest);
  };
  const query = readProjectPullRequests({
    connection: context.connection,
    projectId,
  });
  const result = useAtomValue(query);
  const refresh = useAtomRefresh(query);
  const value = AsyncResult.isFailure(result)
    ? undefined
    : Option.getOrUndefined(AsyncResult.value(result));
  const found =
    value?.kind === 'available'
      ? foundPullRequests(value.pullRequests, branch, reviewId)
      : [];
  const linkable = found.some((entry) => entry.heldBy === undefined);
  const first = found[0]?.pull;
  if (pullRequestBlockHidden(undefined, value)) return null;
  const trailing = () => {
    if (first && found.length === 1)
      return <GitHubLink url={first.url} number={first.number} />;
    if (repository && found.length === 0)
      return (
        <Button
          variant="ghost"
          size="sm"
          nativeButton={false}
          render={
            <a
              href={`https://github.com/${repository}/compare/${encodeURIComponent(branch)}?expand=1`}
              target="_blank"
              rel="noreferrer"
            />
          }
          className="ml-auto"
        >
          Create on GitHub
          <ArrowUpRightIcon aria-hidden="true" />
        </Button>
      );
    return undefined;
  };
  return (
    <PullRequestSection trailing={trailing()}>
      {found.length === 0 && value?.kind === 'available' && (
        <p className="mt-1 text-ui leading-4.75 wrap-anywhere text-foreground-2">
          No pull request for{' '}
          <span className="font-mono text-xs leading-4.75 text-foreground">
            {branch}
          </span>{' '}
          on GitHub.
        </p>
      )}
      {AsyncResult.isInitial(result) && (
        <Skeleton
          aria-label="Finding pull requests"
          className="mt-1 h-16 w-full"
        />
      )}
      <div className="flex min-w-0 flex-col gap-3">
        {found.map(({ pull, heldBy }) => (
          <FoundPull
            key={pull.number}
            pull={pull}
            heldBy={heldBy}
            context={context}
            pending={pending}
            onLink={submit}
          />
        ))}
      </div>
      {result.waiting && (
        <p role="status" className="mt-1.5 text-xs text-muted-foreground">
          Finding pull requests…
        </p>
      )}
      {value?.kind === 'available' && found.length === 0 && (
        <p className="mt-1.5 text-xs leading-4.25 text-muted-foreground">
          When Porcelain finds one, it offers to link it. Or paste its link:
        </p>
      )}
      {value?.kind === 'available' && value.truncated && (
        <p className="mt-1.5 text-xs leading-4.25 text-muted-foreground">
          Some pull requests are not listed. Paste the link to choose one.
        </p>
      )}
      {(AsyncResult.isFailure(result) || value?.kind === 'unavailable') && (
        <PullUnavailable
          reason={value?.kind === 'unavailable' ? value.reason : undefined}
          retrying={result.waiting || pending}
          onRetry={refresh}
        />
      )}
      {(!linkable || (value?.kind === 'available' && value.truncated)) && (
        <form
          className="mt-2 flex min-w-0 items-center gap-1.5"
          onSubmit={(event) => {
            event.preventDefault();
            const link = pullRequestLink(url);
            setMalformed(link === undefined);
            if (link === undefined) setOutcomeStale(true);
            else if (!pending) submit(link);
          }}
        >
          <Input
            ref={inputRef}
            aria-label="Pull request link"
            type="url"
            required
            placeholder="github.com/…/pull/482"
            value={url}
            onChange={(event) => {
              setUrl(event.target.value);
              setMalformed(false);
            }}
            disabled={pending}
            aria-invalid={malformed || undefined}
            className="min-w-0 flex-1"
          />
          <Button
            type="submit"
            variant="outline"
            aria-label="Link pull request"
            className="shrink-0"
            disabled={pending || url.trim() === ''}
          >
            <LinkIcon aria-hidden="true" className="size-3.5" />
            {pending ? 'Linking…' : 'Link'}
          </Button>
        </form>
      )}
      {malformed && (
        <p role="alert" className="mt-1.5 text-xs text-destructive">
          Paste a GitHub pull request link, such as
          https://github.com/owner/repo/pull/482.
        </p>
      )}
      {!outcomeStale && outcome}
    </PullRequestSection>
  );
}
