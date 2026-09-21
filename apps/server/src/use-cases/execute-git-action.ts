import type { GitActionOutcome } from '@porcelain/git/dtos/git-action';
import { GitActionRejectedError } from '@porcelain/git/errors/git-action-rejected-error';
import type { GitActionWriterFactory } from '@porcelain/git/interfaces/git-action-writer';
import type { GitSession } from '@porcelain/git/interfaces/git-session';
import type { GitActionReceipt } from '../models/git-action.ts';
import type { GitActionStore } from '../repositories/interfaces/git-action-store.ts';
import type { InventoryStore } from '../repositories/interfaces/inventory-store.ts';
import type { ReadWorktreeChanges } from './read-worktree-changes.ts';
import { resolveActionCheckout } from './resolve-action-worktree.ts';
import type { ResolveWorktree } from './resolve-worktree.ts';

export class ExecuteGitAction {
  private readonly inventory: InventoryStore;
  private readonly worktrees: ResolveWorktree;
  private readonly store: GitActionStore;
  private readonly git: GitActionWriterFactory;
  private readonly refreshReview:
    | ((worktreeId: string, signal: AbortSignal) => Promise<void>)
    | undefined;
  private readonly changes: ReadWorktreeChanges | undefined;
  constructor(
    inventory: InventoryStore,
    worktrees: ResolveWorktree,
    store: GitActionStore,
    git: GitActionWriterFactory,
    refreshReview?: (worktreeId: string, signal: AbortSignal) => Promise<void>,
    changes?: ReadWorktreeChanges,
  ) {
    this.inventory = inventory;
    this.worktrees = worktrees;
    this.store = store;
    this.git = git;
    this.refreshReview = refreshReview;
    this.changes = changes;
  }
  async executeDirect(
    receipt: GitActionReceipt,
    session: GitSession,
    signal: AbortSignal,
    onProgress?: (line: string) => void,
  ): Promise<void> {
    const intent = receipt.intent;
    const expected = receipt.expected;
    if (!intent || !expected)
      throw new GitActionRejectedError('REQUEST_MISMATCH');
    let outcome: GitActionOutcome;
    try {
      const { checkout } = await resolveActionCheckout(
        this.worktrees,
        this.inventory,
        session,
        receipt,
        signal,
      );
      const writer = this.git(checkout);
      outcome = await writer.executeDirect(
        receipt.requestId,
        intent,
        expected,
        signal,
        onProgress,
        expected.files
          ? async () => {
              if (!this.changes)
                throw new GitActionRejectedError('CHANGED_SINCE_LOOKED');
              const exactChangeList =
                intent.action.startsWith('stash-') ||
                (intent.action === 'commit' && expected.inProgress === 'merge');
              const actual = exactChangeList
                ? new Map(
                    (
                      await this.changes.execute(
                        receipt.worktreeId,
                        session,
                        signal,
                      )
                    ).changes.map((entry) => [entry.path, entry.fingerprint]),
                  )
                : await this.changes.fingerprints(
                    receipt.worktreeId,
                    expected.files?.map((file) => file.path) ?? [],
                    session,
                    signal,
                  );
              if (
                expected.files?.some(
                  (file) => actual.get(file.path) !== file.fingerprint,
                ) ||
                (exactChangeList && actual.size !== expected.files?.length)
              )
                throw new GitActionRejectedError('CHANGED_SINCE_LOOKED');
            }
          : undefined,
      );
    } catch (error) {
      outcome = {
        state:
          error instanceof GitActionRejectedError || !signal.aborted
            ? 'rejected'
            : 'interrupted',
        reason:
          error instanceof GitActionRejectedError
            ? error.reason
            : signal.aborted
              ? 'DEADLINE_EXCEEDED'
              : 'GIT_REJECTED',
        refreshRequired: false,
      };
    }
    if (outcome.state === 'indeterminate') outcome.state = 'interrupted';
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
      finishedAt: Date.now(),
    });
  }
}
