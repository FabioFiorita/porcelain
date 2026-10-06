import { Context, type Effect, type Scope } from 'effect';
import type { LiveConnection } from '../../live/ports/connection.ts';
import type { BrowserSession } from '../rules/browser-session.ts';
import type { Remote } from '../rules/remotes.ts';

export type EnvironmentConnection = LiveConnection & {
  readonly address: string;
};

export type RemoteConnection = {
  readonly remote: Remote;
  readonly connection: EnvironmentConnection;
};

export class ConnectionFactory extends Context.Service<
  ConnectionFactory,
  {
    readonly local: (
      session: BrowserSession,
    ) => Effect.Effect<EnvironmentConnection, never, Scope.Scope>;
  }
>()('@porcelain/client/ConnectionFactory') {}

export class RemoteConnectionFactory extends Context.Service<
  RemoteConnectionFactory,
  {
    readonly open: (
      remote: Remote,
    ) => Effect.Effect<EnvironmentConnection, never, Scope.Scope>;
  }
>()('@porcelain/client/RemoteConnectionFactory') {}
