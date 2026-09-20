import type { FileReader } from '../filesystem/interfaces/file-reader.ts';
import { resolveReadableWorktree } from './resolve-readable-worktree.ts';
import type { ResolveWorktree } from './resolve-worktree.ts';
import { validateFilePath } from './validate-file-path.ts';

export class ListDirectory {
  private readonly worktrees: ResolveWorktree;
  private readonly files: FileReader;
  constructor(worktrees: ResolveWorktree, files: FileReader) {
    this.worktrees = worktrees;
    this.files = files;
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
      signal,
    );
    await resolveReadableWorktree(this.worktrees, worktreeId, signal);
    signal?.throwIfAborted();
    return result;
  }
}
