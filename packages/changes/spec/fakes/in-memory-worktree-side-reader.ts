import type { WorktreeEntry } from '../../src/models/worktree-side.ts';
import type { WorktreeSideReader } from '../../src/ports/worktree-side-reader.ts';

export class InMemoryWorktreeSideReader implements WorktreeSideReader {
  readonly entries = new Map<string, WorktreeEntry>();
  readonly heads = new Map<string, string>();
  stagingStamp: string | undefined = 'staging-1';

  readEntries(): Promise<ReadonlyMap<string, WorktreeEntry>> {
    return Promise.resolve(this.entries);
  }

  readSubmoduleHeads(): Promise<ReadonlyMap<string, string>> {
    return Promise.resolve(this.heads);
  }

  readStagingStamp(): Promise<string | undefined> {
    return Promise.resolve(this.stagingStamp);
  }
}
