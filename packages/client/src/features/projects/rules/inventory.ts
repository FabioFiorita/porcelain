import type { ReadInventoryResponse } from '@porcelain/contracts/projects';

export type Inventory = ReadInventoryResponse;
export type Project = Inventory['projects'][number];

export function worktreeLabel(branch: string | null | undefined) {
  return branch?.replace(/^refs\/heads\//, '') ?? 'Detached HEAD';
}
