import { Context, type Cause, type Effect } from 'effect';

export type ProjectSelectionSnapshot = {
  readonly currentEnvironmentId: string | undefined;
  readonly selections: Readonly<
    Record<string, { readonly projectId: string; readonly worktreeId: string }>
  >;
};

export class ProjectSelectionStorage extends Context.Service<
  ProjectSelectionStorage,
  {
    readonly read: () => Effect.Effect<
      ProjectSelectionSnapshot,
      Cause.UnknownError
    >;
    readonly write: (
      snapshot: ProjectSelectionSnapshot,
    ) => Effect.Effect<void, Cause.UnknownError>;
  }
>()('@porcelain/client/ProjectSelectionStorage') {}
