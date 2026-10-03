import type { FollowedTargets, WatchRequest } from './followed-targets.ts';

type WatchDemand = {
  replace(request: WatchRequest): Promise<FollowedTargets>;
  close(): void;
};

export type OpenedWatch =
  | { kind: 'opened'; demand: WatchDemand }
  | { kind: 'at-capacity' };

export type WatchOpener = {
  open(): OpenedWatch;
};
