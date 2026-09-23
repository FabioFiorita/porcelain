import { validateFilePath } from '../errors/validate-file-path.ts';
import type { DirectoryListing } from '../models/file-content.ts';
import type { FileReader, IgnoredEntries } from '../ports/file-reader.ts';
import type { ReachableWorktreeReader } from '../ports/reachable-worktree.ts';

export class ListDirectoryService {
  private readonly worktrees: ReachableWorktreeReader;
  private readonly files: FileReader;
  private readonly ignored: (root: string) => IgnoredEntries;

  constructor(
    worktrees: ReachableWorktreeReader,
    files: FileReader,
    ignored: (root: string) => IgnoredEntries,
  ) {
    this.worktrees = worktrees;
    this.files = files;
    this.ignored = ignored;
  }

  async execute(
    worktreeId: string,
    path: string,
    signal?: AbortSignal,
  ): Promise<DirectoryListing> {
    validateFilePath(path, true);
    const worktree = await this.worktrees.reachable(worktreeId, signal);
    const result = await this.files.list(
      { worktreeId, root: worktree.path, path },
      this.ignored(worktree.path),
      signal,
    );
    await this.worktrees.reachable(worktreeId, signal);
    signal?.throwIfAborted();
    return result;
  }
}
