import type { IgnoredEntriesReadInput } from '@porcelain/files/models';
import type { IgnoredEntriesReader } from '@porcelain/files/ports';
import { checkIgnored } from '@porcelain/git/inspection';
import {
  knownWorktree,
  type KnownWorktrees,
} from '../projects/checkout-session.ts';

export class GitIgnoredEntriesReader implements IgnoredEntriesReader {
  private readonly worktrees: KnownWorktrees;

  constructor(worktrees: KnownWorktrees) {
    this.worktrees = worktrees;
  }

  async read(
    input: IgnoredEntriesReadInput,
    signal?: AbortSignal,
  ): Promise<ReadonlySet<string>> {
    const checkout = await knownWorktree(
      this.worktrees,
      input.worktreeId,
      signal,
    );
    return checkIgnored(checkout.path, input.paths, signal);
  }
}
