import type {
  CheckWorktreeInput,
  ListedWorktree,
} from '@porcelain/projects/models';
import type { Effect } from 'effect';
import type { WorktreeNotFoundError } from '@porcelain/kernel/errors';
import type {
  ProjectNotFoundError,
  WorktreeUnavailableError,
} from '@porcelain/projects/errors';

export interface CheckWorktreeUseCasePort {
  execute(
    input: CheckWorktreeInput,
  ): Effect.Effect<
    ListedWorktree,
    WorktreeNotFoundError | WorktreeUnavailableError | ProjectNotFoundError
  >;
}
