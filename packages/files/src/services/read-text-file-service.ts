import { validateFilePath } from '../errors/validate-file-path.ts';
import { createHash } from 'node:crypto';
import type { TextContent } from '../models/file-content.ts';
import type { FileReader } from '../ports/file-reader.ts';
import type { ReachableWorktreeReader } from '../ports/reachable-worktree.ts';

export class ReadTextFileService {
  private readonly worktrees: ReachableWorktreeReader;
  private readonly files: FileReader;

  constructor(worktrees: ReachableWorktreeReader, files: FileReader) {
    this.worktrees = worktrees;
    this.files = files;
  }

  async execute(
    worktreeId: string,
    path: string,
    signal?: AbortSignal,
  ): Promise<TextContent> {
    validateFilePath(path, false);
    const worktree = await this.worktrees.reachable(worktreeId, signal);
    const result = await this.files.read(
      { worktreeId, root: worktree.path, path },
      signal,
    );
    await this.worktrees.reachable(worktreeId, signal);
    signal?.throwIfAborted();
    return {
      ...result,
      contentFingerprint: createHash('sha256')
        .update(result.text)
        .digest('hex'),
    };
  }
}
