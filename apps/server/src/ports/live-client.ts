import type { FollowedTargets } from './followed-targets.ts';

export type LiveClient = {
  follow(targets: FollowedTargets): Effect.Effect<void>;
  answered(): Effect.Effect<void>;
  close(): Effect.Effect<void>;
};
import type { Effect } from 'effect';
