import { Context } from 'effect';
import type { WorktreeConsistencyProbe } from './worktree-consistency-probe.ts';
export type LaneOptions = {
  readCapacity: number;
  deadlineMs: number | (() => number);
  consistency: WorktreeConsistencyProbe;
  closeResources?: () => void;
};
export const LaneOptions = Context.Service<
  '@porcelain/server/LaneOptions',
  LaneOptions
>('@porcelain/server/LaneOptions');
