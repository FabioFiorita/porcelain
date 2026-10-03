import type { OperationContext } from './operation-context.ts';

export type WorktreeChange =
  | { worktreeId: string; change: 'files'; paths: readonly string[] }
  | { worktreeId: string; change: 'git' };

export interface AnnounceWorktreeChangeUseCasePort {
  execute(input: WorktreeChange, context: OperationContext): Promise<void>;
}
