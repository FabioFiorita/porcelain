import type {
  CheckWorktreeInput,
  ListedWorktree,
} from '@porcelain/projects/models';
import type { OperationContext } from './operation-context.ts';

export type WorktreeCheck = {
  execute(
    input: CheckWorktreeInput,
    context: OperationContext,
  ): Promise<ListedWorktree>;
};
