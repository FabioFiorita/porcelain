import type { GitFactory } from '@porcelain/git/interfaces/git-factory';
import type {
  FileTreeReader,
  TreePathReader,
} from '../filesystem/interfaces/file-tree-reader.ts';
import type { InventoryStore } from '../repositories/interfaces/inventory-store.ts';
import { resolveReadableWorktree } from './resolve-readable-worktree.ts';
import { validateFilePath } from './validate-file-path.ts';

export class ListFileTree {
  private readonly store: InventoryStore;
  private readonly git: GitFactory;
  private readonly files: FileTreeReader;
  private readonly paths: TreePathReader;
  constructor(
    store: InventoryStore,
    git: GitFactory,
    files: FileTreeReader,
    paths: TreePathReader,
  ) {
    this.store = store;
    this.git = git;
    this.files = files;
    this.paths = paths;
  }
  async execute(worktreeId: string, signal?: AbortSignal) {
    const worktree = await resolveReadableWorktree(
      this.store,
      this.git,
      worktreeId,
      signal,
    );
    const paths = await this.paths(worktree.path, signal);
    for (const path of paths.paths)
      validateFilePath(path.replace(/\/$/, ''), false);
    const result = await this.files.read(
      worktree.path,
      worktreeId,
      paths,
      signal,
    );
    await resolveReadableWorktree(this.store, this.git, worktreeId, signal);
    return result;
  }
}
