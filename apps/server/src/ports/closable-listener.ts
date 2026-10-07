import type { Effect, Scope } from 'effect';

export type ClosableListener = {
  address: string;
  close(): Effect.Effect<void>;
};

export type NetworkListener = {
  start(options: {
    host: string;
    port: number;
  }): Effect.Effect<ClosableListener, never, Scope.Scope>;
};

export type SocketListener = {
  start(options: {
    path: string;
  }): Effect.Effect<ClosableListener, never, Scope.Scope>;
};
