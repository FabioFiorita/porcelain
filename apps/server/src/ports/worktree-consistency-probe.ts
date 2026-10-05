import type { ConfirmWorktreeInput } from '@porcelain/projects/models';
import type { WorktreeChangedError } from '@porcelain/kernel/errors';
import type { Effect } from 'effect';

export interface WorktreeConsistencyProbe {
  execute(
    input: ConfirmWorktreeInput,
  ): Effect.Effect<void, WorktreeChangedError>;
}
