import type {
  FileTreeReader,
  TreePathReader,
} from '../filesystem/interfaces/file-tree-reader.ts';
import { resolveReadableWorktree } from './resolve-readable-worktree.ts';
import type { ResolveWorktree } from './resolve-worktree.ts';
import { validateFilePath } from './validate-file-path.ts';

export class ListFileTree {
  private readonly worktrees: ResolveWorktree;
  private readonly files: FileTreeReader;
  private readonly paths: TreePathReader;
  constructor(
    worktrees: ResolveWorktree,
    files: FileTreeReader,
    paths: TreePathReader,
  ) {
    this.worktrees = worktrees;
    this.files = files;
    this.paths = paths;
  }
  async execute(worktreeId: string, signal?: AbortSignal) {
    const worktree = await resolveReadableWorktree(
      this.worktrees,
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
    await resolveReadableWorktree(this.worktrees, worktreeId, signal);
    return result;
  }
}
