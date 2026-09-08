import { inspectCommitChanges } from './commands/inspect-commit-changes.ts';
import { listCommits } from './commands/list-commits.ts';
import type { CommitCursorCodec } from './commit-cursor.ts';
import type {
  CommitChangesRequest,
  CommitPageRequest,
  HistoryCheckout,
} from './dtos/commit-history.ts';
import type { CommitReader } from './interfaces/commit-reader.ts';

export class CommitGit implements CommitReader {
  private readonly checkout: HistoryCheckout;
  private readonly cursor: CommitCursorCodec;
  constructor(checkout: HistoryCheckout, cursor: CommitCursorCodec) {
    this.checkout = checkout;
    this.cursor = cursor;
  }
  listCommits(request: CommitPageRequest, signal?: AbortSignal) {
    return listCommits(this.checkout, this.cursor, request, signal);
  }
  inspectCommitChanges(request: CommitChangesRequest, signal?: AbortSignal) {
    return inspectCommitChanges(this.checkout, request, signal);
  }
}
