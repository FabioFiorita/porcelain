import type { GitActionOutcome } from '@porcelain/git/dtos/git-action';
import { GitActionRejectedError } from '@porcelain/git/errors/git-action-rejected-error';
import type { GitActionWriterFactory } from '@porcelain/git/interfaces/git-action-writer';
import type { GitSession } from '@porcelain/git/interfaces/git-session';
import type { GitActionReceipt } from '../models/git-action.ts';
import type { GitActionStore } from '../repositories/interfaces/git-action-store.ts';
import type { InventoryStore } from '../repositories/interfaces/inventory-store.ts';
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
  constructor(
    inventory: InventoryStore,
    worktrees: ResolveWorktree,
    store: GitActionStore,
    git: GitActionWriterFactory,
    refreshReview?: (worktreeId: string, signal: AbortSignal) => Promise<void>,
  ) {
    this.inventory = inventory;
    this.worktrees = worktrees;
    this.store = store;
    this.git = git;
    this.refreshReview = refreshReview;
  }
  async execute(
    receipt: GitActionReceipt,
    session: GitSession,
    signal: AbortSignal,
  ): Promise<void> {
    const state = { launched: false };
    const outcome = await this.perform(receipt, session, signal, state).catch(
      (error: unknown): GitActionOutcome => {
        if (
          error instanceof GitActionRejectedError &&
          error.reason === 'PROCESS_GROUP_UNCONFIRMED'
        ) {
          return {
            state: 'indeterminate',
            reason: error.reason,
            refreshRequired: true,
          };
        }
        return {
          state: state.launched ? 'indeterminate' : 'rejected',
          reason: state.launched
            ? 'OUTCOME_UNKNOWN'
            : error instanceof GitActionRejectedError
              ? error.reason
              : signal.aborted
                ? 'DEADLINE_EXCEEDED'
                : 'GIT_REJECTED',
          refreshRequired: state.launched,
        };
      },
    );
    if (outcome.reason === 'PROCESS_GROUP_UNCONFIRMED')
      this.store.blockProject(receipt.projectId);
    if (
      this.refreshReview &&
      receipt.action === 'commit' &&
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
  private async perform(
    receipt: GitActionReceipt,
    session: GitSession,
    signal: AbortSignal,
    state: { launched: boolean },
  ): Promise<GitActionOutcome> {
    signal.throwIfAborted();
    if (this.store.isBlocked(receipt.projectId))
      throw new GitActionRejectedError('PROCESS_GROUP_UNCONFIRMED');
    const preparation = this.store.preparation(receipt.preparationId);
    if (!preparation || preparation.expiresAt <= Date.now())
      throw new GitActionRejectedError('STALE_PREPARATION');
    const { checkout } = await resolveActionCheckout(
      this.worktrees,
      this.inventory,
      session,
      receipt,
      signal,
    );
    const git = this.git(checkout);
    const snapshot = await git.inspect(preparation.intent, signal);
    if (snapshot.fingerprint !== preparation.fingerprint)
      throw new GitActionRejectedError('STALE_PREPARATION');
    signal.throwIfAborted();
    this.store.finish({ ...receipt, refreshRequired: true });
    state.launched = true;
    return git.execute(
      {
        id: preparation.id,
        intent: preparation.intent,
        preview: preparation.preview,
      },
      snapshot,
      signal,
    );
  }
}
