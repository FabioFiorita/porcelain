import type { ReadReviewResponse } from '@porcelain/contracts/reviews';
export type LinkedRevision = NonNullable<ReadReviewResponse['revision']>;
import { useAtomValue, useAtomRefresh } from '@effect/atom-react';
import { Effect } from 'effect';
import { Atom } from 'effect/reactivity';
import { ProjectSelectionCommands } from '@porcelain/client/projects';
import { readReview, reviewCommands } from '@porcelain/client/reviews';
import type { RuntimeConnection } from '@porcelain/client/transport';
import { clientRuntime } from '../../../shared/application/store';

export const selectReviewEnvironment = Atom.family((environmentId: string) =>
  clientRuntime
    .atom(
      Effect.gen(function* () {
        const selection = yield* ProjectSelectionCommands;
        yield* selection.execute({ kind: 'environment', environmentId });
      }),
    )
    .pipe(Atom.setIdleTTL(0)),
);

export const openReview = Atom.family(
  (input: {
    connection: RuntimeConnection;
    reviewId: string;
    revision: number;
  }) =>
    Atom.make((get) => {
      const seen = reviewCommands(input).seen;
      get.mount(seen);
      get.set(seen, input.revision);
    }).pipe(Atom.setIdleTTL(0)),
);

export function useLinkedReview(
  input: Parameters<typeof import('@porcelain/client/reviews').readReview>[0],
) {
  const query = readReview(input);
  return { result: useAtomValue(query), refresh: useAtomRefresh(query) };
}
