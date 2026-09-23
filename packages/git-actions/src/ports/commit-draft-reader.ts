import type { GitActionScope } from '../models/git-action-scope.ts';
import type { CommitDraftSnapshotReader } from './commit-draft-snapshot-reader.ts';

export interface CommitDraftReader {
  open(scope: GitActionScope, signal?: AbortSignal): CommitDraftSnapshotReader;
}
