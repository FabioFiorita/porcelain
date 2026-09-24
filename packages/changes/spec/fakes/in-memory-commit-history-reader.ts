import type {
  CommitFiles,
  CommitFilesLookup,
  CommitPage,
  CommitPatches,
  CommitPatchesRequest,
} from '../../src/models/commit-history.ts';
import type { ReadCommitFilesInput } from '../../src/models/read-commit-files.ts';
import type { CommitHistoryReader } from '../../src/ports/commit-history-reader.ts';

export class InMemoryCommitHistoryReader implements CommitHistoryReader {
  readonly commits = new Map<string, CommitFiles>();
  readonly patches = new Map<string, CommitPatches>();

  listCommits(): Promise<CommitPage> {
    return Promise.resolve({
      snapshot: undefined,
      commits: [...this.commits.values()].map((files) => files.commit),
      nextAfter: undefined,
      tip: undefined,
      boundary: undefined,
      restarted: false,
    });
  }

  readCommitFiles(input: ReadCommitFilesInput): Promise<CommitFilesLookup> {
    const files = this.commits.get(input.oid);
    return Promise.resolve(
      files === undefined ? { kind: 'missing' } : { kind: 'found', files },
    );
  }

  readCommitPatches(input: CommitPatchesRequest): Promise<CommitPatches> {
    return Promise.resolve(
      this.patches.get(input.oid) ?? { kind: 'within-limit', patches: [] },
    );
  }
}
