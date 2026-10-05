import type { FollowedTargets, WatchRequest } from './followed-targets.ts';

type WatchDemand = {
  replace(request: WatchRequest): Effect.Effect<FollowedTargets>;
  close(): Effect.Effect<void>;
};

export type OpenedWatch =
  | { kind: 'opened'; demand: WatchDemand }
  | { kind: 'at-capacity' };

export type WatchOpener = {
  open(): Effect.Effect<OpenedWatch, never, Scope.Scope>;
};
import type { Effect, Scope } from 'effect';
