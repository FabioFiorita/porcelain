import { Context, type Cause, type Effect } from 'effect';

export class WorktreeSnapshotStorage extends Context.Service<
  WorktreeSnapshotStorage,
  {
    readonly read: (
      environmentId: string,
    ) => Effect.Effect<string | null, Cause.UnknownError>;
    readonly write: (
      environmentId: string,
      snapshot: string,
    ) => Effect.Effect<void, Cause.UnknownError>;
    readonly remove: (
      environmentId: string,
    ) => Effect.Effect<void, Cause.UnknownError>;
  }
>()('@porcelain/client/WorktreeSnapshotStorage') {}
