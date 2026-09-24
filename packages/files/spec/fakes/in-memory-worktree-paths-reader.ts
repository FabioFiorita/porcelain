import type { WorktreePathsRead } from '../../src/models/worktree-paths-read.ts';
import type { WorktreePathsReader } from '../../src/ports/worktree-paths-reader.ts';

export class InMemoryWorktreePathsReader implements WorktreePathsReader {
  private readonly stored: WorktreePathsRead;

  constructor(stored: WorktreePathsRead) {
    this.stored = stored;
  }

  read(): Promise<WorktreePathsRead> {
    return Promise.resolve(this.stored);
  }
}
