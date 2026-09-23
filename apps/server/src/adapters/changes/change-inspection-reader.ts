import { join } from 'node:path';
import { observedSides, sidePaths } from '@porcelain/changes/models';
import type { ChangeInspectionReader } from '@porcelain/changes/ports';
import type { GitSession, InspectionFactory } from '@porcelain/git/inspection';
import type { StampPath, WorktreeFiles } from '../files/worktree-files.ts';
import type { InventoryStore } from '@porcelain/projects/ports';
import { resolveCheckoutSession } from '../git/checkout-session.ts';
import type { ResolveWorktree } from '../projects/resolve-worktree.ts';

export function createChangeInspectionReader(
  store: InventoryStore,
  worktrees: ResolveWorktree,
  inspection: InspectionFactory,
  files: WorktreeFiles,
  stamp: StampPath,
) {
  return (worktreeId: string, session: GitSession): ChangeInspectionReader => {
    let resolved:
      | Promise<{
          environmentId: string;
          worktree: Awaited<ReturnType<ResolveWorktree['reachable']>>;
          git: ReturnType<InspectionFactory>;
        }>
      | undefined;
    const reader = (signal?: AbortSignal) => {
      resolved ??= resolveCheckoutSession(
        worktrees,
        store,
        session,
        worktreeId,
        signal,
      ).then(({ environmentId, worktree, checkout }) => ({
        environmentId,
        worktree,
        git: inspection(checkout),
      }));
      return resolved;
    };
    return {
      missingFingerprint: null,
      readStatus: async (signal) => {
        const { environmentId, git } = await reader(signal);
        const status = await git.readStatus(signal);
        return {
          environmentId,
          status: {
            ...status,
            inProgress: status.inProgress ?? null,
            mergeHeadOid: status.mergeHeadOid ?? null,
            branch: status.branch ?? null,
          },
        };
      },
      observeSides: async (changes, signal) => {
        const { worktree, git } = await reader(signal);
        const { submodules, ordinary } = sidePaths(changes);
        if (submodules.length === 0 && ordinary.length === 0)
          return { sides: new Map(), stamps: new Map() };
        const [entries, heads] = await Promise.all([
          files(worktree.path, ordinary),
          submodules.length > 0
            ? git.readSubmoduleHeads(submodules, signal)
            : new Map<string, string>(),
        ]);
        signal?.throwIfAborted();
        return observedSides(submodules, ordinary, entries, heads);
      },
      readDiffs: async (changes, signal) => {
        const { git } = await reader(signal);
        return git.readDiffs(changes, signal);
      },
      stampIndex: async () => {
        const { worktree } = await reader();
        return stamp(join(worktree.administrativeDirectory, 'index'));
      },
      confirmReachable: async (id, signal) => {
        await worktrees.reachable(id, signal);
      },
    };
  };
}
