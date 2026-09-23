import type { IgnoredEntriesReader } from '@porcelain/files/ports';
import { checkIgnored } from '@porcelain/git/inspection';
import type { WorktreeCheckouts } from './worktree-checkouts.ts';

export class IgnoredEntriesReaderAdapter implements IgnoredEntriesReader {
  private readonly worktreeCheckouts: WorktreeCheckouts;

  constructor(worktreeCheckouts: WorktreeCheckouts) {
    this.worktreeCheckouts = worktreeCheckouts;
  }

  async read(
    worktreeId: string,
    paths: readonly string[],
    signal?: AbortSignal,
  ): Promise<ReadonlySet<string>> {
    const checkout = await this.worktreeCheckouts.known(worktreeId, signal);
    return checkIgnored(checkout.path, paths, signal);
  }
}
