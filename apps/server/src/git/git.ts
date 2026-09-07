import { listWorktrees } from './commands/list-worktrees.ts';
import type { DiscoveryIssue } from './dtos/discovery-issue.ts';
import type { WorktreeReader } from './interfaces/git-factory.ts';

export class Git implements WorktreeReader {
  private readonly checkout: string;

  constructor(checkout: string) {
    this.checkout = checkout;
  }

  listWorktrees(
    signal?: AbortSignal,
    reportIssue?: (issue: DiscoveryIssue) => void,
  ) {
    return listWorktrees(this.checkout, signal, reportIssue);
  }
}
