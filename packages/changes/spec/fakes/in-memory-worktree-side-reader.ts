import type { WorktreeEntry } from '@porcelain/changes/models';
import type { WorktreeSideReader } from '@porcelain/changes/ports';

export class InMemoryWorktreeSideReader implements WorktreeSideReader {
  readonly entries = new Map<string, WorktreeEntry>();
  readonly heads = new Map<string, string>();
  stagingStamp: string | undefined = 'staging-1';

  readEntries(
    _worktreeId: string,
    paths: readonly string[],
  ): Promise<ReadonlyMap<string, WorktreeEntry>> {
    return Promise.resolve(
      new Map(
        paths.flatMap((path) => {
          const entry = this.entries.get(path);
          return entry ? [[path, entry] as const] : [];
        }),
      ),
    );
  }

  readSubmoduleHeads(
    _worktreeId: string,
    paths: readonly string[],
  ): Promise<ReadonlyMap<string, string>> {
    return Promise.resolve(
      new Map(
        paths.flatMap((path) => {
          const head = this.heads.get(path);
          return head ? [[path, head] as const] : [];
        }),
      ),
    );
  }

  readStagingStamp(): Promise<string | undefined> {
    return Promise.resolve(this.stagingStamp);
  }
}
