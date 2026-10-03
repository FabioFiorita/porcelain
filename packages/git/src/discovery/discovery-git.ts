import { listWorktrees } from './commands/list-worktrees.ts';
import { readOriginUrl } from './commands/read-origin-url.ts';
import type { WorktreeReader } from './interfaces/git-factory.ts';
import type { GitLimits } from '../shared/dtos/git-limits.ts';

export class DiscoveryGit implements WorktreeReader {
  private readonly checkout: string;
  private readonly limits: GitLimits;

  constructor(checkout: string, limits: GitLimits) {
    this.checkout = checkout;
    this.limits = limits;
  }

  listWorktrees(signal?: AbortSignal, known?: { commonDirectory: string }) {
    return listWorktrees(this.checkout, this.limits, signal, known);
  }

  readOriginUrl(signal?: AbortSignal) {
    return readOriginUrl(this.checkout, this.limits, signal);
  }
}
