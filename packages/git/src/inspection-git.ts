import { readDiff, readDiffs } from './commands/read-diff.ts';
import { readLines } from './commands/read-lines.ts';
import { readBranchDetails, readStatus } from './commands/read-status.ts';
import { readSubmoduleHeads } from './commands/read-submodule-heads.ts';
import type { GitOrdinaryChange } from './dtos/git-status.ts';
import type { LineRange } from './dtos/line-range.ts';
import type { ChangeReader } from './interfaces/change-reader.ts';
import type { DiffReader } from './interfaces/diff-reader.ts';
import type { CheckoutSession } from './interfaces/git-session.ts';
import type { StatusReader } from './interfaces/status-reader.ts';

/**
 * Reads one checkout for one request. The request's session owns the identity
 * guard and the conversion-filter check, so both run once here instead of
 * around every call.
 */
export class InspectionGit implements StatusReader, DiffReader, ChangeReader {
  private readonly session: CheckoutSession;

  constructor(session: CheckoutSession) {
    this.session = session;
  }

  async readStatus(signal?: AbortSignal) {
    await this.session.verify(signal);
    return readStatus(this.session, signal);
  }

  async readDiff(change: GitOrdinaryChange, signal?: AbortSignal) {
    await this.session.verify(signal);
    return readDiff(this.session, change, signal);
  }

  async readDiffs(changes: readonly GitOrdinaryChange[], signal?: AbortSignal) {
    await this.session.verify(signal);
    return readDiffs(this.session, changes, signal);
  }

  async readSubmoduleHeads(paths: readonly string[], signal?: AbortSignal) {
    await this.session.verify(signal);
    return readSubmoduleHeads(this.session, paths, signal);
  }

  async readBranchDetails(branch: string | null, signal?: AbortSignal) {
    await this.session.verify(signal);
    return readBranchDetails(this.session, branch, signal);
  }

  async readLines(range: Omit<LineRange, 'at'>, signal?: AbortSignal) {
    await this.session.verify(signal);
    return readLines(this.session, range, signal);
  }
}
