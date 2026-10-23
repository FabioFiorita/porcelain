import { Context, type Cause, type Effect } from 'effect';
import type { ConnectionRoute, Remote } from '../rules/remotes.ts';

export type MissingCredentialRemote = Pick<
  Remote,
  'environmentId' | 'name' | 'operationIdentity'
> & {
  readonly routes: readonly Pick<ConnectionRoute, 'address' | 'deviceId'>[];
};

export type EnvironmentSnapshot = {
  readonly remotes: readonly Remote[];
  readonly missingCredentials: readonly MissingCredentialRemote[];
};

export class EnvironmentStorage extends Context.Service<
  EnvironmentStorage,
  {
    readonly read: () => Effect.Effect<EnvironmentSnapshot, Cause.UnknownError>;
    readonly write: (
      snapshot: EnvironmentSnapshot,
    ) => Effect.Effect<void, Cause.UnknownError>;
  }
>()('@porcelain/client/EnvironmentStorage') {}
