import type { WorktreePathsRead } from '../../src/models/index.ts';
import type { WorktreePathsReader } from '../../src/ports/index.ts';

export class MemoryWorktreePaths implements WorktreePathsReader {
  private readonly paths: readonly string[];
  private readonly limit: number;

  constructor(paths: readonly string[], limit: number) {
    this.paths = paths;
    this.limit = limit;
  }

  read(): Promise<WorktreePathsRead> {
    return Promise.resolve(
      this.paths.length > this.limit
        ? { kind: 'too-large' }
        : { kind: 'paths', paths: [...this.paths] },
    );
  }
}
