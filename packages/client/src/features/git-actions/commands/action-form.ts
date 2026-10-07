import type { ReadChangesResponse } from '@porcelain/contracts/changes';
import { statusFromChanges, type GitActionStatus } from '../rules/status.ts';
import type { Cause } from 'effect';
import { Effect } from 'effect';

export const lookAgainGitAction = Effect.fn('GitActions.lookAgain')(function* <
  E,
>(
  read: Effect.Effect<void, Cause.UnknownError>,
  startNew: Effect.Effect<void, E>,
) {
  yield* read;
  yield* startNew;
});

export const refreshGitLook = Effect.fn('GitActions.refreshLook')(function* (
  read: Effect.Effect<ReadChangesResponse, Cause.UnknownError>,
  looked: (status: GitActionStatus) => void,
) {
  looked(statusFromChanges(yield* read));
});
