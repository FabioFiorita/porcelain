import { readCommitDiffs } from '../inspection/index.ts';
import type { GitLimits } from '../shared/dtos/git-limits.ts';
import { isOid } from '../shared/oid.ts';
import { confirmHistoryCheckout } from './commands/inspect-history-checkout.ts';
import { listCommits } from './commands/list-commits.ts';
import { readCommitFiles } from './commands/read-commit-files.ts';
import type {
  CommitDiffsRequest,
  CommitFilesRequest,
  CommitPageRequest,
  HistoryCheckout,
} from './dtos/commit-history.ts';
import { InvalidHistoryRequestError } from './errors/invalid-history-request-error.ts';
import type { CommitReader } from './interfaces/commit-reader.ts';

export class HistoryGit implements CommitReader {
  private readonly checkout: HistoryCheckout;
  private readonly gitVersion: Buffer;
  private readonly limits: GitLimits;

  constructor(
    checkout: HistoryCheckout,
    gitVersion: Buffer,
    limits: GitLimits,
  ) {
    this.checkout = checkout;
    this.gitVersion = gitVersion;
    this.limits = limits;
  }

  listCommits(request: CommitPageRequest, signal?: AbortSignal) {
    return listCommits(
      this.checkout,
      this.gitVersion,
      request,
      this.limits,
      signal,
    );
  }

  readCommitFiles(request: CommitFilesRequest, signal?: AbortSignal) {
    return readCommitFiles(
      this.checkout,
      this.gitVersion,
      request,
      this.limits,
      signal,
    );
  }

  async readCommitDiffs(request: CommitDiffsRequest, signal?: AbortSignal) {
    const parent = request.parent ?? 1;
    if (
      request.paths.length === 0 ||
      !Number.isInteger(parent) ||
      parent < 1 ||
      !isOid(request.oid)
    )
      throw new InvalidHistoryRequestError();
    await confirmHistoryCheckout(this.checkout);
    const diffs = await readCommitDiffs(
      this.checkout.path,
      request.oid,
      parent,
      request.paths,
      this.limits,
      signal,
    );
    await confirmHistoryCheckout(this.checkout);
    return diffs;
  }
}
