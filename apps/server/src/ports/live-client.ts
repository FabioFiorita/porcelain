import type { FollowedTargets } from './followed-targets.ts';

export type LiveClient = {
  follow(targets: FollowedTargets): void;
  answered(): void;
  close(): void;
};
