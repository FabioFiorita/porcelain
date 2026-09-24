import type { WorktreeKey } from '@porcelain/kernel/models';
import type { OperationContext } from './operation-context.ts';

export interface RefreshWorktreeReviewUseCasePort {
  execute(input: WorktreeKey, context: OperationContext): Promise<void>;
}
