import { listWorktrees } from './worktrees/list-worktrees.ts';
import type { WorktreeReader } from './worktrees/worktree-inventory.ts';

export class Git implements WorktreeReader {
  private readonly checkout: string;

  constructor(checkout: string) {
    this.checkout = checkout;
  }

  listWorktrees() {
    return listWorktrees(this.checkout);
  }
}
