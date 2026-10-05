import type { LiveChannel } from './live-channel.ts';
import type { LiveClient } from './live-client.ts';

export type LiveConnector = {
  connect(channel: LiveChannel): Effect.Effect<LiveClient, never, Scope.Scope>;
};
import type { Effect, Scope } from 'effect';
