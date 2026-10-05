import type { Effect } from 'effect';

export type Job = {
  start(): Effect.Effect<void>;
  stop(): Effect.Effect<void>;
};
