import type { FileReader } from '../filesystem/interfaces/file-reader.ts';
import type { GitFactory } from '../git/interfaces/git-factory.ts';
import type { InventoryStore } from '../repositories/interfaces/inventory-store.ts';
import { resolveReadableWorktree } from './resolve-readable-worktree.ts';
import { validateFilePath } from './validate-file-path.ts';

export class ReadTextFile {
  private readonly store: InventoryStore;
  private readonly git: GitFactory;
  private readonly files: FileReader;
  constructor(store: InventoryStore, git: GitFactory, files: FileReader) {
    this.store = store;
    this.git = git;
    this.files = files;
  }
  async execute(worktreeId: string, path: string, signal?: AbortSignal) {
    validateFilePath(path, false);
    const worktree = await resolveReadableWorktree(
      this.store,
      this.git,
      worktreeId,
      signal,
    );
    const result = await this.files.read(
      { worktreeId, root: worktree.path, path },
      signal,
    );
    await resolveReadableWorktree(this.store, this.git, worktreeId, signal);
    signal?.throwIfAborted();
    return result;
  }
}
