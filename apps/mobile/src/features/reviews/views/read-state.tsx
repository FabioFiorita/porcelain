import { Cause } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { ErrorState } from '../../../components/ui/error-state';
import { Loading } from '../../../components/ui/loading';
import { reviewErrorMessage } from '@porcelain/client/reviews/rules';

export function ReviewReadState<A, E>({
  result,
  refresh,
}: {
  result: AsyncResult.AsyncResult<A, E>;
  refresh: () => void;
}) {
  return AsyncResult.isFailure(result) ? (
    <ErrorState
      message={reviewErrorMessage(Cause.squash(result.cause))}
      retry={{ label: 'Read again', onPress: refresh }}
    />
  ) : (
    <Loading label="Loading review…" />
  );
}
