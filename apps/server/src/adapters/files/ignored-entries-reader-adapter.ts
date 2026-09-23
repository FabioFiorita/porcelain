import type { IgnoredEntriesReader } from '@porcelain/files/ports';
import { checkIgnored } from '@porcelain/git/inspection';
import {
  knownWorktree,
  type KnownWorktrees,
} from '../projects/checkout-session.ts';

export class IgnoredEntriesReaderAdapter implements IgnoredEntriesReader {
  private readonly worktrees: KnownWorktrees;

  constructor(worktrees: KnownWorktrees) {
    this.worktrees = worktrees;
  }

  async read(
    worktreeId: string,
    paths: readonly string[],
    signal?: AbortSignal,
  ): Promise<ReadonlySet<string>> {
    const checkout = await knownWorktree(this.worktrees, worktreeId, signal);
    return checkIgnored(checkout.path, paths, signal);
  }
}
