import type { ConfirmWorktreeInput } from '@porcelain/projects/models';

export interface WorktreeConsistencyProbe {
  execute(input: ConfirmWorktreeInput): void;
}
