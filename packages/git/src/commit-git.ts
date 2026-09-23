import { confirmHistoryCheckout } from './commands/inspect-history-checkout.ts';
import { listCommits } from './commands/list-commits.ts';
import { readCommitFiles } from './commands/read-commit-files.ts';
import { readCommitDiffs } from './commands/read-diff.ts';
import type {
  CommitDiffsRequest,
  CommitFilesRequest,
  CommitPageRequest,
  HistoryCheckout,
} from './dtos/commit-history.ts';
import { InvalidHistoryRequestError } from './errors/invalid-history-request-error.ts';
import type { CommitReader } from './interfaces/commit-reader.ts';

export class CommitGit implements CommitReader {
  private readonly checkout: HistoryCheckout;
  constructor(checkout: HistoryCheckout) {
    this.checkout = checkout;
  }
  listCommits(request: CommitPageRequest, signal?: AbortSignal) {
    return listCommits(this.checkout, request, signal);
  }
  readCommitFiles(request: CommitFilesRequest, signal?: AbortSignal) {
    return readCommitFiles(this.checkout, request, signal);
  }
  async readCommitDiffs(request: CommitDiffsRequest, signal?: AbortSignal) {
    const parent = request.parent ?? 1;
    if (
      request.paths.length === 0 ||
      !Number.isInteger(parent) ||
      parent < 1 ||
      !/^[0-9a-f]{40}(?:[0-9a-f]{24})?$/.test(request.oid)
    )
      throw new InvalidHistoryRequestError();
    return this.guarded(async () =>
      readCommitDiffs(
        this.checkout.path,
        request.oid,
        parent,
        request.paths,
        signal,
      ),
    );
  }

  private async guarded<T>(read: () => Promise<T>): Promise<T> {
    await confirmHistoryCheckout(this.checkout);
    const result = await read();
    await confirmHistoryCheckout(this.checkout);
    return result;
  }
}
