import { useAtom, useAtomRefresh, useAtomValue } from '@effect/atom-react';
import { Cause, Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import {
  readReview,
  readReviewPullRequest,
  reviewCommands,
} from '@porcelain/client/reviews';
import {
  reviewErrorMessage,
  reviewPullRequestNotice,
  pullRequestStateLabel,
  pullRequestHeadLabel,
} from '@porcelain/client/reviews/rules';
import type { RuntimeConnection } from '@porcelain/client/transport';
import { Box } from '../../../components/ui/box';
import { Text } from '../../../components/ui/text';
import { Button } from '../../../components/ui/button';
import { ErrorState } from '../../../components/ui/error-state';
import { Loading } from '../../../components/ui/loading';
import { useOpenPullRequest } from '../../projects';
import { pullRequestNumber } from '@porcelain/client/reviews/rules';

export function PullRequestState({
  connection,
  reviewId,
}: {
  connection: RuntimeConnection;
  reviewId: string;
}) {
  const input = { connection, reviewId };
  const review = useAtomValue(readReview(input));
  const query = readReviewPullRequest(input);
  const result = useAtomValue(query);
  const refresh = useAtomRefresh(query);
  const [mutation, setPullRequest] = useAtom(
    reviewCommands(input).setPullRequest,
  );
  const openPullRequest = useOpenPullRequest();
  const pull = AsyncResult.isFailure(result)
    ? { kind: 'failed' as const }
    : (Option.getOrUndefined(AsyncResult.value(result)) ?? {
        kind: 'loading' as const,
      });
  const notice = reviewPullRequestNotice(pull);
  if (!AsyncResult.isSuccess(review) || !review.value.review?.pullRequest)
    return null;
  const url = review.value.review.pullRequest;
  const projectId = review.value.review.projectId;
  const number = pullRequestNumber(url);
  const available = pull.kind === 'available' ? pull.pullRequest : undefined;
  return (
    <Box gap={3} padding={4}>
      <Text variant="caption" tone="muted">
        Pull request
      </Text>
      <Text variant="ui" weight="medium">
        {available ? `#${available.number} ${available.title}` : url}
      </Text>
      {available && (
        <>
          <Text variant="caption">
            {pullRequestStateLabel(available)} ·{' '}
            {available.checksSummary
              ? `Checks: ${available.checksSummary}`
              : 'No GitHub checks'}
          </Text>
          {available.state === 'open' && !available.matchesReviewHead ? (
            <Text variant="caption">
              {pullRequestHeadLabel(available)}. PR at {available.headSha} ·
              review read {review.value.revision?.headOid ?? 'unknown'}
            </Text>
          ) : (
            <Text variant="caption" tone="muted">
              {available.state === 'open'
                ? `${pullRequestHeadLabel(available)}.`
                : 'This review is closed and remains readable.'}
            </Text>
          )}
        </>
      )}
      {pull.kind === 'loading' ? (
        <Loading label="Reading pull request…" />
      ) : null}
      {notice && pull.kind !== 'loading' && (
        <ErrorState
          message={notice}
          retry={{
            label: 'Read pull request again',
            onPress: refresh,
            pending: result.waiting,
          }}
        />
      )}
      {available && (
        <Button
          label="Read pull request again"
          variant="ghost"
          pending={result.waiting}
          onPress={refresh}
        />
      )}
      <Button
        label="Open pull request"
        variant="outline"
        disabled={number === undefined}
        onPress={() => {
          if (number !== undefined)
            openPullRequest({
              kind: 'pull-request',
              environmentId: connection.environmentId,
              projectId,
              reviewId,
              number,
            });
        }}
      />
      <Button
        label="Unlink pull request"
        variant="outline"
        pending={mutation.waiting}
        onPress={() => setPullRequest({ pullRequest: undefined })}
      />
      <Text variant="caption" tone="muted">
        Unlink keeps this review and follows its branch again. Link a pull
        request from the web or desktop app.
      </Text>
      {AsyncResult.isFailure(mutation) && (
        <ErrorState
          message={reviewErrorMessage(Cause.squash(mutation.cause))}
        />
      )}
    </Box>
  );
}
