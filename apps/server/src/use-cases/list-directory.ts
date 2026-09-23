import type { FileReader } from '../filesystem/interfaces/file-reader.ts';
import type { IgnoredEntries } from '../filesystem/interfaces/ignored-entries.ts';
import { resolveReadableWorktree } from './resolve-readable-worktree.ts';
import type { ResolveWorktree } from './resolve-worktree.ts';
import { validateFilePath } from './validate-file-path.ts';

export class ListDirectory {
  private readonly worktrees: ResolveWorktree;
  private readonly files: FileReader;
  private readonly ignored: (root: string) => IgnoredEntries;

  constructor(
    worktrees: ResolveWorktree,
    files: FileReader,
    ignored: (root: string) => IgnoredEntries,
  ) {
    this.worktrees = worktrees;
    this.files = files;
    this.ignored = ignored;
  }

  async execute(worktreeId: string, path: string, signal?: AbortSignal) {
    validateFilePath(path, true);
    const worktree = await resolveReadableWorktree(
      this.worktrees,
      worktreeId,
      signal,
    );
    const result = await this.files.list(
      { worktreeId, root: worktree.path, path },
      this.ignored(worktree.path),
      signal,
    );
    await resolveReadableWorktree(this.worktrees, worktreeId, signal);
    signal?.throwIfAborted();
    return result;
  }
}
