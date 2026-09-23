import type {
  CommitFiles,
  CommitFilesRequest,
  CommitPage,
  CommitPatch,
  CommitPatches,
} from '@porcelain/changes/models';
import type { CommitHistoryReader } from '@porcelain/changes/ports';

export class InMemoryCommitHistoryReader implements CommitHistoryReader {
  readonly commits = new Map<string, CommitFiles>();
  readonly patches = new Map<string, CommitPatch[]>();
  readonly overLimit = new Set<string>();

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

  readCommitFiles(
    _worktreeId: string,
    request: CommitFilesRequest,
  ): Promise<CommitFiles | undefined> {
    return Promise.resolve(this.commits.get(request.oid));
  }

  readCommitPatches(
    _worktreeId: string,
    request: CommitFilesRequest,
  ): Promise<CommitPatches> {
    if (this.overLimit.has(request.oid))
      return Promise.resolve({ kind: 'over-limit' });
    return Promise.resolve({
      kind: 'within-limit',
      patches: this.patches.get(request.oid) ?? [],
    });
  }
}
