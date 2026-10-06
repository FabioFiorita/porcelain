import type { Effect } from 'effect';
export type Runtime = {
  address: string;
  socketPath: string;
  close(): Effect.Effect<void>;
};
