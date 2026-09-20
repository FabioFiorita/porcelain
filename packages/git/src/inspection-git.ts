import { readDiff, readDiffs } from './commands/read-diff.ts';
import { readStatus } from './commands/read-status.ts';
import type { GitOrdinaryChange } from './dtos/git-status.ts';
import type { DiffReader } from './interfaces/diff-reader.ts';
import type { CheckoutSession } from './interfaces/git-session.ts';
import type { StatusReader } from './interfaces/status-reader.ts';

/**
 * Reads one checkout for one request. The request's session owns the identity
 * guard and the conversion-filter check, so both run once here instead of
 * around every call.
 */
export class InspectionGit implements StatusReader, DiffReader {
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
}
