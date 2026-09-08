import type { GitChangeSelection } from '@porcelain/git/dtos/git-status';
import type { InspectionFactory } from '@porcelain/git/interfaces/inspection-factory';
import type { InventoryStore } from '../repositories/interfaces/inventory-store.ts';
import { WorktreeChangedError } from './errors/worktree-changed-error.ts';
import { resolveInspectionWorktree } from './resolve-inspection-worktree.ts';

export class ReadWorktreeDiff {
  private readonly store: InventoryStore;
  private readonly git: InspectionFactory;

  constructor(store: InventoryStore, git: InspectionFactory) {
    this.store = store;
    this.git = git;
  }

  async execute(
    worktreeId: string,
    expectedStatusToken: string,
    selection: GitChangeSelection,
    signal?: AbortSignal,
  ) {
    signal?.throwIfAborted();
    const { environmentId, worktree, metadataIdentity, repositoryIdentity } =
      resolveInspectionWorktree(this.store, worktreeId);
    const git = this.git(worktree.path, metadataIdentity, repositoryIdentity);
    const before = await git.readStatus(signal);
    if (before.statusToken !== expectedStatusToken)
      throw new WorktreeChangedError();
    const change = before.changes.find(
      (entry) =>
        (entry.scope === 'staged' || entry.scope === 'unstaged') &&
        entry.scope === selection.scope &&
        entry.oldPath === selection.oldPath &&
        entry.newPath === selection.newPath,
    );
    if (!change || change.scope === 'untracked' || change.scope === 'unmerged')
      throw new WorktreeChangedError();
    const content = await git.readDiff(change, signal);
    const after = await git.readStatus(signal);
    signal?.throwIfAborted();
    if (after.statusToken !== before.statusToken)
      throw new WorktreeChangedError();
    return {
      environmentId,
      worktreeId,
      statusToken: after.statusToken,
      change,
      content,
    };
  }
}
