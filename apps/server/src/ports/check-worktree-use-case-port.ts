import {
  type CheckWorktreeInput,
  type ListedWorktree,
} from '@porcelain/projects/models';
import { type Effect, Context } from 'effect';
import { type WorktreeNotFoundError } from '@porcelain/kernel/errors';
import {
  type ProjectNotFoundError,
  type WorktreeUnavailableError,
} from '@porcelain/projects/errors';

export interface CheckWorktreeUseCasePort {
  execute(
    input: CheckWorktreeInput,
  ): Effect.Effect<
    ListedWorktree,
    WorktreeNotFoundError | WorktreeUnavailableError | ProjectNotFoundError
  >;
}

export const CheckWorktreeUseCasePort = Context.Service<
  '@porcelain/server/CheckWorktreeUseCasePort',
  CheckWorktreeUseCasePort
>('@porcelain/server/CheckWorktreeUseCasePort');
