import type { GitActionIntent } from '@porcelain/git/dtos/git-action';
import { GitActionRejectedError } from '@porcelain/git/errors/git-action-rejected-error';
import type { GitActionWriterFactory } from '@porcelain/git/interfaces/git-action-writer';
import type {
  GitActionPreparation,
  GitActionScope,
} from '../models/git-action.ts';
import type { GitActionStore } from '../repositories/interfaces/git-action-store.ts';
import type { InventoryStore } from '../repositories/interfaces/inventory-store.ts';
import type { ReadWorktreeEvidence } from './read-worktree-evidence.ts';
import { resolveActionWorktree } from './resolve-action-worktree.ts';

export class PrepareGitAction {
  private readonly inventory: InventoryStore;
  private readonly store: GitActionStore;
  private readonly git: GitActionWriterFactory;
  private readonly evidence: ReadWorktreeEvidence | undefined;
  private readonly uuid: () => string;
  constructor(
    inventory: InventoryStore,
    store: GitActionStore,
    git: GitActionWriterFactory,
    uuid: () => string,
    evidence?: ReadWorktreeEvidence,
  ) {
    this.inventory = inventory;
    this.store = store;
    this.git = git;
    this.uuid = uuid;
    this.evidence = evidence;
  }
  async execute(
    scope: GitActionScope,
    intent: GitActionIntent,
    signal: AbortSignal,
  ): Promise<GitActionPreparation> {
    if (this.store.isBlocked(scope.projectId))
      throw new GitActionRejectedError('PROCESS_GROUP_UNCONFIRMED');
    const target = resolveActionWorktree(this.inventory, scope);
    const snapshot = await this.git(
      target.worktree.path,
      target.metadataIdentity,
      target.repositoryIdentity,
    )
      .inspect(intent, signal)
      .catch((error: unknown) => {
        if (
          error instanceof GitActionRejectedError &&
          error.reason === 'PROCESS_GROUP_UNCONFIRMED'
        ) {
          try {
            this.store.blockProject(scope.projectId);
          } catch (cause) {
            throw new GitActionRejectedError(error.reason, { cause });
          }
        }
        throw error;
      });
    if (intent.action === 'commit' && intent.expectedFiles) {
      if (!this.evidence) throw new GitActionRejectedError('STALE_PREPARATION');
      const current = await this.evidence.execute(scope.worktreeId, signal);
      if (
        intent.expectedFiles.some(
          (expected) =>
            current.evidence.find((entry) => entry.path === expected.path)
              ?.fingerprint !== expected.fingerprint,
        )
      )
        throw new GitActionRejectedError('STALE_PREPARATION');
      const verified = await this.git(
        target.worktree.path,
        target.metadataIdentity,
        target.repositoryIdentity,
      ).inspect(intent, signal);
      if (verified.fingerprint !== snapshot.fingerprint)
        throw new GitActionRejectedError('STALE_PREPARATION');
    }
    signal.throwIfAborted();
    const preparation = {
      ...scope,
      id: this.uuid(),
      expiresAt: Date.now() + 300_000,
      intent,
      fingerprint: snapshot.fingerprint,
      preview: snapshot.preview,
    };
    this.store.savePreparation(preparation);
    return preparation;
  }
}
