import { Effect } from 'effect';
import { Atom } from 'effect/reactivity';
import type {
  RuntimeConnection,
  WorktreeScope,
} from '../../../shared/api/connection.ts';
import { clientRuntime } from '../../../shared/api/runtime.ts';
import { ReadInvalidation } from '../../../shared/api/read-invalidation.ts';
import { queryKeys } from '../../../shared/api/query-keys.ts';
import {
  readChangesSnapshot,
  readGitStatusSnapshot,
} from '../queries/changes.ts';

type Selection = { connection: RuntimeConnection; scope: WorktreeScope };

function invalidate(selection: Selection, surfaces: readonly string[]) {
  return ReadInvalidation.refreshNow(
    surfaces.map((surface) =>
      queryKeys.reviewSurface(
        selection.connection.environmentId,
        selection.scope,
        [surface],
      ),
    ),
  );
}

export const readCurrentChanges = Atom.family((selection: Selection) =>
  clientRuntime(selection.connection).fn(
    Effect.fn('Changes.readCurrent')((_: void) =>
      Effect.tap(readChangesSnapshot(selection), () =>
        invalidate(selection, ['changes']),
      ),
    ),
  ),
);
export const refreshGitLook = Atom.family((selection: Selection) =>
  clientRuntime(selection.connection).fn(
    Effect.fn('Changes.refreshGitLook')((_: void) =>
      Effect.tap(readChangesSnapshot(selection), () =>
        invalidate(selection, ['changes', 'git-status']),
      ),
    ),
  ),
);
export const readCurrentGitStatus = Atom.family((selection: Selection) =>
  clientRuntime(selection.connection).fn(
    Effect.fn('Changes.readCurrentGitStatus')((_: void) =>
      Effect.tap(readGitStatusSnapshot(selection), () =>
        invalidate(selection, ['git-status']),
      ),
    ),
  ),
);
