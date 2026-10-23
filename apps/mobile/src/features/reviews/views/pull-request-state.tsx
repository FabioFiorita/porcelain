import { useAtomRefresh, useAtomValue } from '@effect/atom-react';
import { Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { readReview, readReviewPullRequest } from '@porcelain/client/reviews';
import { reviewPullRequestNotice } from '@porcelain/client/reviews/rules';
import type { RuntimeConnection } from '@porcelain/client/transport';
import { ErrorState } from '../../../components/ui/error-state';
import { Loading } from '../../../components/ui/loading';

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
  const pull = AsyncResult.isFailure(result)
    ? { kind: 'failed' as const }
    : (Option.getOrUndefined(AsyncResult.value(result)) ?? {
        kind: 'loading' as const,
      });
  const notice = reviewPullRequestNotice(pull);
  if (
    !AsyncResult.isSuccess(review) ||
    !review.value.review?.pullRequest ||
    !notice
  )
    return null;
  return pull.kind === 'loading' ? (
    <Loading label={notice} />
  ) : (
    <ErrorState
      message={notice}
      retry={{
        label: 'Read pull request again',
        onPress: refresh,
        pending: result.waiting,
      }}
    />
  );
}
