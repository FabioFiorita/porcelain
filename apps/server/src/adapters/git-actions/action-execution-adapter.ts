import { ActionExecutionRejectedError } from '@porcelain/git-actions/errors';
import type {
  GitActionExpectation,
  GitActionIntent,
  GitActionReceipt,
  GitActionScope,
} from '@porcelain/git-actions/models';
import type {
  ActionChangeReaderPort,
  ActionExecutionPort,
} from '@porcelain/git-actions/ports';
import {
  GitActionRejectedError,
  RequestGitSession,
} from '@porcelain/git/actions';
import type { GitActionWriterFactory } from '@porcelain/git/actions';
import type { GitSession } from '@porcelain/git/inspection';

type Checkout = Parameters<GitActionWriterFactory>[0];

export class ActionExecutionAdapter implements ActionExecutionPort {
  private readonly resolveCheckout: (
    scope: GitActionScope,
    session: GitSession,
    signal: AbortSignal,
  ) => Promise<Checkout>;
  private readonly git: GitActionWriterFactory;
  private readonly readAll: (
    worktreeId: string,
    session: GitSession,
    signal: AbortSignal,
  ) => Promise<ReadonlyMap<string, string | null>>;
  private readonly readSelected: (
    worktreeId: string,
    paths: readonly string[],
    session: GitSession,
    signal: AbortSignal,
  ) => Promise<ReadonlyMap<string, string>>;

  constructor(
    resolveCheckout: (
      scope: GitActionScope,
      session: GitSession,
      signal: AbortSignal,
    ) => Promise<Checkout>,
    git: GitActionWriterFactory,
    readAll: (
      worktreeId: string,
      session: GitSession,
      signal: AbortSignal,
    ) => Promise<ReadonlyMap<string, string | null>>,
    readSelected: (
      worktreeId: string,
      paths: readonly string[],
      session: GitSession,
      signal: AbortSignal,
    ) => Promise<ReadonlyMap<string, string>>,
  ) {
    this.resolveCheckout = resolveCheckout;
    this.git = git;
    this.readAll = readAll;
    this.readSelected = readSelected;
  }

  async run(
    receipt: GitActionReceipt,
    intent: GitActionIntent,
    expected: GitActionExpectation,
    signal: AbortSignal,
    onProgress: ((line: string) => void) | undefined,
    verifyTarget: (changes: ActionChangeReaderPort) => Promise<void>,
  ) {
    const session = new RequestGitSession();
    try {
      const checkout = await this.resolveCheckout(receipt, session, signal);
      const writer = this.git(checkout);
      return await writer.executeDirect(
        receipt.requestId,
        intent,
        expected,
        signal,
        onProgress,
        expected.files
          ? () =>
              verifyTarget({
                allFingerprints: () =>
                  this.readAll(receipt.worktreeId, session, signal),
                fingerprints: (paths) =>
                  this.readSelected(receipt.worktreeId, paths, session, signal),
              })
          : undefined,
      );
    } catch (error) {
      if (error instanceof GitActionRejectedError)
        throw new ActionExecutionRejectedError(error.reason, error.detail);
      throw error;
    }
  }
}
