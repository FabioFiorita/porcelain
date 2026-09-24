import { listWorktrees } from './commands/list-worktrees.ts';
import { readOriginUrl } from './commands/read-origin-url.ts';
import type { WorktreeReader } from './interfaces/git-factory.ts';

export class DiscoveryGit implements WorktreeReader {
  private readonly checkout: string;

  constructor(checkout: string) {
    this.checkout = checkout;
  }

  listWorktrees(signal?: AbortSignal, known?: { commonDirectory: string }) {
    return listWorktrees(this.checkout, signal, known);
  }

  readOriginUrl(signal?: AbortSignal) {
    return readOriginUrl(this.checkout, signal);
  }
}
