import { useAtomValue } from '@effect/atom-react';
import { Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { GitPullRequestIcon, TriangleAlertIcon } from 'lucide-react';
import {
  readProjectPullRequests,
  readReviewPullRequest,
} from '@porcelain/client/reviews';
import {
  foundPullRequests,
  pullRequestBlockHidden,
  pullRequestChecks,
  pullRequestHeadLabel,
  pullRequestNumber,
  pullRequestStateLabel,
} from '@porcelain/client/reviews/rules';
import type { ConnectionContext } from '@/shared/workspace/connection';
import type { PullRequestRead } from '@porcelain/client/reviews/rules';
import {
  ChecksStatus,
  Dot,
  PullRequestChip,
  pullStateIcon,
  pullStateText,
} from './pull-request-parts';

type Props = {
  reviewId: string;
  projectId: string;
  branch: string;
  url: string | undefined;
  context: ConnectionContext;
  onOpen: (number: number) => void;
  onShowPanel: (trigger: HTMLButtonElement, focusInput: boolean) => void;
};

export function ReviewPullRequestChip(props: Props) {
  return props.url ? (
    <LinkedChip {...props} url={props.url} />
  ) : (
    <DiscoveryChip {...props} />
  );
}

function LinkedChip({
  reviewId,
  context,
  url,
  onOpen,
  onShowPanel,
}: Props & { url: string }) {
  const result = useAtomValue(
    readReviewPullRequest({ connection: context.connection, reviewId }),
  );
  const value = AsyncResult.isFailure(result)
    ? undefined
    : Option.getOrUndefined(AsyncResult.value(result));
  const number = pullRequestNumber(url);
  if (value?.kind === 'available')
    return <AvailableChip pull={value.pullRequest} onOpen={onOpen} />;
  const waiting =
    !AsyncResult.isFailure(result) &&
    (value === undefined || value.kind === 'not-linked');
  return (
    <PullRequestChip
      variant="linked"
      description={
        waiting
          ? 'Reading pull request'
          : 'GitHub unavailable. Open the Review panel to recover.'
      }
      icon={GitPullRequestIcon}
      onClick={(event) => onShowPanel(event.currentTarget, false)}
    >
      {number && (
        <>
          <span>#{number}</span>
          <Dot />
        </>
      )}
      <span
        className={
          waiting
            ? 'text-muted-foreground'
            : 'inline-flex items-center gap-1 text-warn'
        }
      >
        {!waiting && (
          <TriangleAlertIcon aria-hidden="true" className="size-3" />
        )}
        {waiting ? 'Reading…' : 'GitHub unavailable'}
      </span>
    </PullRequestChip>
  );
}

function AvailableChip({
  pull,
  onOpen,
}: {
  pull: Extract<PullRequestRead, { kind: 'available' }>['pullRequest'];
  onOpen: Props['onOpen'];
}) {
  const checks = pullRequestChecks(
    pull.checks,
    pull.checksTruncated,
    pull.checksSummary,
  );
  const headDiffers = pull.state === 'open' && !pull.matchesReviewHead;
  const details = pull.state !== 'open' ? 'Review closed' : checks.label;
  const status = () => {
    if (pull.state !== 'open')
      return <span className="text-muted-foreground">review closed</span>;
    if (headDiffers)
      return (
        <span className="inline-flex items-center gap-1 text-warn">
          <TriangleAlertIcon aria-hidden="true" className="size-3" />
          {pullRequestHeadLabel(pull)}
        </span>
      );
    return (
      <ChecksStatus
        tone={checks.tone}
        label={checks.short}
        className="text-muted-foreground"
      />
    );
  };
  return (
    <PullRequestChip
      variant="linked"
      description={`Open pull request #${pull.number}: ${pullRequestStateLabel(pull)}. ${headDiffers ? pullRequestHeadLabel(pull) : details}.`}
      icon={pullStateIcon(pull)}
      onClick={() => onOpen(pull.number)}
    >
      <span>#{pull.number}</span>
      <Dot />
      <span className={pullStateText(pull)}>{pullRequestStateLabel(pull)}</span>
      <Dot />
      {status()}
    </PullRequestChip>
  );
}

function DiscoveryChip({
  context,
  projectId,
  reviewId,
  branch,
  onShowPanel,
}: Props) {
  const result = useAtomValue(
    readProjectPullRequests({ connection: context.connection, projectId }),
  );
  const value = AsyncResult.isFailure(result)
    ? undefined
    : Option.getOrUndefined(AsyncResult.value(result));
  if (pullRequestBlockHidden(undefined, value)) return null;
  const found =
    value?.kind === 'available'
      ? foundPullRequests(value.pullRequests, branch, reviewId).find(
          (entry) => entry.heldBy === undefined,
        )?.pull
      : undefined;
  return (
    <PullRequestChip
      variant={found ? 'found' : 'empty'}
      description={
        found
          ? `Link pull request #${found.number} from the Review panel`
          : 'Link pull request'
      }
      icon={found ? pullStateIcon(found) : undefined}
      onClick={(event) => onShowPanel(event.currentTarget, found === undefined)}
    >
      {found ? (
        <>
          <span>#{found.number} found</span>
          <Dot />
          <span className="text-brand">Link</span>
        </>
      ) : (
        'Link pull request'
      )}
    </PullRequestChip>
  );
}
