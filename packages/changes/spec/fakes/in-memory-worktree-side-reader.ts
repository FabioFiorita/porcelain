import type {
  SubmoduleHeadsRequest,
  WorktreeEntriesRequest,
  WorktreeEntry,
} from '../../src/models/worktree-side.ts';
import type { WorktreeSideReader } from '../../src/ports/worktree-side-reader.ts';

export class InMemoryWorktreeSideReader implements WorktreeSideReader {
  private readonly entries: ReadonlyMap<string, WorktreeEntry>;
  private readonly heads: ReadonlyMap<string, string>;
  private readonly stagingStamp: string | undefined;

  constructor(
    stored: {
      entries?: Record<string, WorktreeEntry> | undefined;
      heads?: Record<string, string> | undefined;
      stagingStamp?: string | undefined;
    } = {},
  ) {
    this.entries = new Map(Object.entries(stored.entries ?? {}));
    this.heads = new Map(Object.entries(stored.heads ?? {}));
    this.stagingStamp = stored.stagingStamp ?? 'staging-1';
  }

  readEntries(
    input: WorktreeEntriesRequest,
  ): Promise<ReadonlyMap<string, WorktreeEntry>> {
    return Promise.resolve(
      new Map([...this.entries].filter(([path]) => input.paths.includes(path))),
    );
  }

  readSubmoduleHeads(
    input: SubmoduleHeadsRequest,
  ): Promise<ReadonlyMap<string, string>> {
    return Promise.resolve(
      new Map([...this.heads].filter(([path]) => input.paths.includes(path))),
    );
  }

  readStagingStamp(): Promise<string | undefined> {
    return Promise.resolve(this.stagingStamp);
  }
}
