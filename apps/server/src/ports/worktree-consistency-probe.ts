import { type ConfirmWorktreeInput } from '@porcelain/projects/models';
import { type WorktreeChangedError } from '@porcelain/kernel/errors';
import { type Effect, Context } from 'effect';

export interface WorktreeConsistencyProbe {
  execute(
    input: ConfirmWorktreeInput,
  ): Effect.Effect<void, WorktreeChangedError>;
}

export const WorktreeConsistencyProbe = Context.Service<
  '@porcelain/server/WorktreeConsistencyProbe',
  WorktreeConsistencyProbe
>('@porcelain/server/WorktreeConsistencyProbe');
