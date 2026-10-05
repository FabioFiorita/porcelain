import { Context, type Cause, type Effect } from 'effect';
import type { Remote } from '../rules/remotes.ts';

export class EnvironmentStorage extends Context.Service<
  EnvironmentStorage,
  {
    readonly read: () => Effect.Effect<Remote[], Cause.UnknownError>;
    readonly write: (
      remotes: readonly Remote[],
    ) => Effect.Effect<void, Cause.UnknownError>;
  }
>()('@porcelain/client/EnvironmentStorage') {}
