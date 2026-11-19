import { Atom } from 'effect/reactivity';
import type { RuntimeConnection, WorktreeScope } from './connection.ts';
import { ReadInvalidation } from './read-invalidation.ts';
import { clientRuntime } from './runtime.ts';
import { queryKeys } from './query-keys.ts';

export const retryWorktreeReads = Atom.family((connection: RuntimeConnection) =>
  clientRuntime(connection).fn((scope: WorktreeScope) =>
    ReadInvalidation.refreshNow([
      queryKeys.review(connection.environmentId, scope),
    ]),
  ),
);
