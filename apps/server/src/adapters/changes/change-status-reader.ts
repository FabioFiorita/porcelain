import type { ChangeStatusReader } from '@porcelain/changes/ports';
import type { GitSession, InspectionFactory } from '@porcelain/git/inspection';
import type { InventoryStore } from '@porcelain/projects/ports';
import { resolveCheckoutSession } from '../projects/checkout-session.ts';
import type { WorktreeAccessAdapter as ResolveWorktree } from '../projects/worktree-access-adapter.ts';

export function createChangeStatusReader(
  store: InventoryStore,
  worktrees: ResolveWorktree,
  inspection: InspectionFactory,
) {
  return async (
    worktreeId: string,
    session: GitSession,
    signal?: AbortSignal,
  ) => {
    const { environmentId, checkout } = await resolveCheckoutSession(
      worktrees,
      store,
      session,
      worktreeId,
      signal,
    );
    const git = inspection(checkout);
    const reader: ChangeStatusReader = {
      readStatus: (operationSignal) => git.readStatus(operationSignal),
      readBranchDetails: (branch, headOid, operationSignal) =>
        git.readBranchDetails(branch ?? null, headOid, operationSignal),
    };
    return { environmentId, reader };
  };
}
