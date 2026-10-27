import { useState, type ReactNode } from 'react';
import { useAtom, useAtomRefresh, useAtomValue } from '@effect/atom-react';
import { Cause, Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import {
  readReview,
  readReviewPullRequest,
  readProjectPullRequests,
  reviewCommands,
} from '@porcelain/client/reviews';
import {
  reviewErrorMessage,
  reviewPullRequestNotice,
  pullRequestStateLabel,
  pullRequestBlockHidden,
  pullRequestLink,
} from '@porcelain/client/reviews/rules';
import type { ConnectionContext } from '@/shared/workspace/connection';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { TruncatedText } from '@/shared/views/truncated-text';

type Props = { reviewId: string; context: ConnectionContext };
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

export function PullRequestBlock({ reviewId, context }: Props) {
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
  const available = pull?.kind === 'available' ? pull.pullRequest : undefined;
  const notice = reviewPullRequestNotice(pull);
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
        <Alert variant="destructive">
          <AlertDescription>
            {reviewErrorMessage(Cause.squash(mutation.cause))}
          </AlertDescription>
        </Alert>
      )}
      {answer?.kind === 'unavailable' && (
        <Alert>
          <AlertDescription>
            {reviewPullRequestNotice(answer)} Try again after GitHub is
            available.
          </AlertDescription>
        </Alert>
      )}
    </>
  );
  if (!AsyncResult.isFailure(record) && data?.review && !linked)
    return (
      <PullRequestDiscovery
        context={context}
        projectId={data.review.projectId}
        branch={data.review.branch}
        pending={mutation.waiting}
        outcome={outcome}
        inputRef={(element) =>
          returnFocusTo(element, 'unlinked', focusTarget, () =>
            setFocusReturn(undefined),
          )
        }
        onLink={(pullRequest) => {
          setFocusReturn('linked');
          setPullRequest({ pullRequest });
        }}
      />
    );
  return (
    <PullRequestSection linked={linked}>
      {AsyncResult.isFailure(record) && (
        <Alert variant="destructive">
          <AlertDescription>
            Could not display this review.
            <Button variant="outline" size="sm" onClick={refreshRecord}>
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      )}
      {!AsyncResult.isFailure(record) && !data?.review && (
        <Skeleton className="h-8 w-full" />
      )}
      {!AsyncResult.isFailure(record) && data?.review && linked && (
        <>
          <TruncatedText
            text={
              available ? `#${available.number} ${available.title}` : linked
            }
            className="font-medium"
          />
          {available && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">
                  {pullRequestStateLabel(available)}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {available.checksSummary
                    ? `Checks: ${available.checksSummary}`
                    : 'No GitHub checks'}
                  {available.checksTruncated ? ' · Partial checks' : ''}
                </span>
              </div>
              {available.state === 'open' && !available.matchesReviewHead ? (
                <p className="wrap-anywhere text-xs text-warn">
                  GitHub has commits newer than this review. PR at{' '}
                  <code>{available.headSha}</code> · review read{' '}
                  <code>{data.revision?.headOid ?? 'unknown'}</code>
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {available.state === 'open'
                    ? 'Same head as the review.'
                    : `This review closed with the ${available.state} pull request. It stays readable under Closed.`}
                </p>
              )}
            </>
          )}
          {!pull && <p role="status">Reading pull request…</p>}
          {notice && (
            <Alert>
              <AlertDescription>
                {notice}
                <Button
                  size="sm"
                  variant="outline"
                  disabled={result.waiting}
                  onClick={refresh}
                >
                  Read pull request again
                </Button>
              </AlertDescription>
            </Alert>
          )}
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<a href={linked} target="_blank" rel="noreferrer" />}
          >
            Open pull request
          </Button>
          <Button
            ref={(element) =>
              returnFocusTo(element, 'linked', focusTarget, () =>
                setFocusReturn(undefined),
              )
            }
            size="sm"
            variant="ghost"
            disabled={mutation.waiting}
            onClick={() => {
              setFocusReturn('unlinked');
              setPullRequest({ pullRequest: undefined });
            }}
          >
            {mutation.waiting ? 'Unlinking…' : 'Unlink pull request'}
          </Button>
          <p className="text-xs text-muted-foreground">
            Unlink keeps this review and follows its branch again.
          </p>
        </>
      )}
      {outcome}
    </PullRequestSection>
  );
}

function PullRequestSection({
  linked,
  children,
}: {
  linked?: string | undefined;
  children: ReactNode;
}) {
  return (
    <section
      aria-label="Pull request"
      className="m-2 flex max-h-96 min-w-0 shrink-0 flex-col gap-2 overflow-y-auto rounded-xl border p-3 text-sm"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">Pull request</span>
        {linked && (
          <a
            href={linked}
            target="_blank"
            rel="noreferrer"
            className="text-xs underline"
          >
            On GitHub ↗
          </a>
        )}
      </div>
      {children}
    </section>
  );
}

function PullRequestDiscovery({
  context,
  projectId,
  branch,
  pending,
  outcome,
  inputRef,
  onLink,
}: {
  context: ConnectionContext;
  projectId: string;
  branch: string;
  pending: boolean;
  outcome: ReactNode;
  inputRef: (element: HTMLInputElement | null) => void;
  onLink: (url: string) => void;
}) {
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
      ? value.pullRequests.filter(
          (pull) => pull.headBranch === branch && pull.state === 'open',
        )
      : [];
  if (pullRequestBlockHidden(undefined, value)) return null;
  return (
    <PullRequestSection>
      <p className="wrap-anywhere text-xs">
        No pull request linked for <code>{branch}</code>.
      </p>
      {found.map((pull) => (
        <div key={pull.number} className="flex min-w-0 flex-col gap-2">
          <TruncatedText
            text={`#${pull.number} ${pull.title}`}
            className="font-medium"
          />
          <p className="text-xs text-muted-foreground">
            Found for this branch{pull.draft ? ' · Draft' : ''}
          </p>
          <Button size="sm" disabled={pending} onClick={() => submit(pull.url)}>
            Link to this review
          </Button>
        </div>
      ))}
      {result.waiting && (
        <p role="status" className="text-xs">
          Finding pull requests…
        </p>
      )}
      {value?.kind === 'available' && found.length === 0 && (
        <p className="text-xs text-muted-foreground">
          When Porcelain finds one, it offers to link it. Or paste its link
          below.
        </p>
      )}
      {value?.kind === 'available' && value.truncated && (
        <p className="text-xs text-muted-foreground">
          Some pull requests are not listed. Paste the link to choose one.
        </p>
      )}
      {(AsyncResult.isFailure(result) || value?.kind === 'unavailable') && (
        <Alert>
          <AlertDescription>
            {value?.kind === 'unavailable'
              ? reviewPullRequestNotice(value)
              : 'Could not display pull requests.'}
          </AlertDescription>
        </Alert>
      )}
      <Button
        size="sm"
        variant="ghost"
        disabled={result.waiting || pending}
        onClick={refresh}
      >
        Find pull requests again
      </Button>
      <form
        className="flex min-w-0 flex-col gap-2"
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
          aria-label="GitHub pull request URL"
          type="url"
          required
          placeholder="https://github.com/owner/repo/pull/482"
          value={url}
          onChange={(event) => {
            setUrl(event.target.value);
            setMalformed(false);
          }}
          disabled={pending}
          aria-invalid={malformed || undefined}
        />
        {malformed && (
          <p role="alert" className="text-xs text-destructive">
            Paste a GitHub pull request link, such as
            https://github.com/owner/repo/pull/482.
          </p>
        )}
        <Button
          type="submit"
          size="sm"
          variant="outline"
          disabled={pending || url.trim() === ''}
        >
          {pending ? 'Linking…' : 'Link pull request'}
        </Button>
      </form>
      {!outcomeStale && outcome}
    </PullRequestSection>
  );
}
