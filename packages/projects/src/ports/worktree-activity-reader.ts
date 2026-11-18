import { type Effect, Context } from 'effect';
import {
  type WorktreeActivityObservation,
  type WorktreeActivityTarget,
} from '../models/worktree-activity.ts';

export interface WorktreeActivityReader {
  read(
    targets: readonly WorktreeActivityTarget[],
  ): Effect.Effect<readonly WorktreeActivityObservation[]>;
}

export const WorktreeActivityReader = Context.Service<
  '@porcelain/projects/WorktreeActivityReader',
  WorktreeActivityReader
>('@porcelain/projects/WorktreeActivityReader');
