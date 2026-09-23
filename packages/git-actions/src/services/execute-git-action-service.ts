import { ActionExecutionRejectedError } from '../errors/action-execution-rejected-error.ts';
import type {
  GitActionOutcome,
  GitActionReceipt,
} from '../models/git-action.ts';
import type { ActionExecutionPort } from '../ports/action-execution-port.ts';
import type { GitActionStore } from '../ports/git-action-store.ts';
import type { ReviewRefreshPort } from '../ports/review-refresh-port.ts';

export class ExecuteGitActionService {
  private readonly execution: ActionExecutionPort;
  private readonly store: Pick<GitActionStore, 'finish'>;
  private readonly refreshReview: ReviewRefreshPort | undefined;
  private readonly now: () => number;

  constructor(
    execution: ActionExecutionPort,
    store: Pick<GitActionStore, 'finish'>,
    refreshReview?: ReviewRefreshPort,
    now: () => number = Date.now,
  ) {
    this.execution = execution;
    this.store = store;
    this.refreshReview = refreshReview;
    this.now = now;
  }

  async execute(
    receipt: GitActionReceipt,
    signal: AbortSignal,
    onProgress?: (line: string) => void,
  ): Promise<void> {
    const intent = receipt.intent;
    const expected = receipt.expected;
    if (!intent || !expected)
      throw new ActionExecutionRejectedError('REQUEST_MISMATCH');

    let outcome: GitActionOutcome;
    try {
      outcome = await this.execution.run(
        receipt,
        intent,
        expected,
        signal,
        onProgress,
        async (changes) => {
          if (!expected.files) return;
          const exactChangeList =
            intent.action.startsWith('stash-') ||
            (intent.action === 'commit' && expected.inProgress === 'merge');
          const actual = exactChangeList
            ? await changes.allFingerprints()
            : await changes.fingerprints(
                expected.files.map((file) => file.path),
              );
          if (
            expected.files.some(
              (file) => actual.get(file.path) !== file.fingerprint,
            ) ||
            (exactChangeList && actual.size !== expected.files.length)
          )
            throw new ActionExecutionRejectedError('CHANGED_SINCE_LOOKED');
        },
      );
    } catch (error) {
      outcome = {
        state:
          error instanceof ActionExecutionRejectedError || !signal.aborted
            ? 'rejected'
            : 'interrupted',
        reason:
          error instanceof ActionExecutionRejectedError
            ? error.reason
            : signal.aborted
              ? 'DEADLINE_EXCEEDED'
              : 'GIT_REJECTED',
        ...(error instanceof ActionExecutionRejectedError && error.detail
          ? { message: error.detail }
          : {}),
        refreshRequired: false,
      };
    }
    if (outcome.state === 'indeterminate')
      outcome = { ...outcome, state: 'interrupted' };
    if (
      this.refreshReview &&
      (receipt.action === 'commit' || receipt.action === 'amend') &&
      outcome.state === 'succeeded'
    )
      await this.refreshReview(receipt.worktreeId, signal).catch(
        () => undefined,
      );
    this.store.finish({
      ...receipt,
      ...outcome,
      finishedAt: this.now(),
    });
  }
}
