import type { ReadReviewResponse } from '@porcelain/contracts/reviews';
export type LinkedRevision = NonNullable<ReadReviewResponse['revision']>;
import { useAtomValue, useAtomRefresh } from '@effect/atom-react';
import { Cause, Effect, Predicate } from 'effect';
import { AsyncResult, Atom } from 'effect/reactivity';
import { ProjectSelectionCommands } from '@porcelain/client/projects';
import { readReview, reviewCommands } from '@porcelain/client/reviews';
import {
  RequestError,
  type RuntimeConnection,
} from '@porcelain/client/transport';
import { clientRuntime } from '../../../shared/application/store';

export const selectReviewEnvironment = Atom.family(
  ({
    environmentId,
    currentEnvironmentId,
    focused,
  }: {
    environmentId: string;
    currentEnvironmentId: string | undefined;
    focused: boolean;
  }) => {
    const select = clientRuntime.fn((_: void) =>
      Effect.gen(function* () {
        if (!focused || currentEnvironmentId === environmentId) return;
        const selection = yield* ProjectSelectionCommands;
        yield* selection.execute({ kind: 'environment', environmentId });
      }),
    );
    const start = Atom.make((get) => {
      get.mount(select);
      get.set(select, undefined);
    }).pipe(Atom.setIdleTTL(0));
    return { select, start };
  },
);

export const openReview = Atom.family(
  (input: {
    connection: RuntimeConnection;
    reviewId: string;
    revision: number;
    focused: boolean;
  }) =>
    Atom.make((get) => {
      if (!input.focused) return;
      const seen = reviewCommands({
        connection: input.connection,
        reviewId: input.reviewId,
      }).seen;
      get.mount(seen);
      get.set(seen, input.revision);
    }).pipe(Atom.setIdleTTL(0)),
);

export function useLinkedReview(input: Parameters<typeof readReview>[0]) {
  const query = readReview(input);
  const result = useAtomValue(query);
  const error = AsyncResult.isFailure(result)
    ? Cause.squash(result.cause)
    : undefined;
  return {
    result,
    refresh: useAtomRefresh(query),
    missing:
      (error instanceof RequestError && error.status === 404) ||
      Predicate.isTagged(error, 'ReviewNotFoundError'),
  };
}
