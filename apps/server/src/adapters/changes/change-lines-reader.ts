import type { ChangeLinesReader } from '@porcelain/changes/ports';
import type { FileReader } from '@porcelain/files/ports';
import type { GitSession, InspectionFactory } from '@porcelain/git/inspection';
import type { InventoryStore } from '@porcelain/projects/ports';
import { resolveCheckoutSession } from '../git/checkout-session.ts';
import type { ResolveWorktree } from '../projects/resolve-worktree.ts';

export function createChangeLinesReader(
  store: InventoryStore,
  worktrees: ResolveWorktree,
  inspection: InspectionFactory,
  files: FileReader,
) {
  return async (
    worktreeId: string,
    session: GitSession,
    signal?: AbortSignal,
  ) => {
    const { environmentId, worktree, checkout } = await resolveCheckoutSession(
      worktrees,
      store,
      session,
      worktreeId,
      signal,
    );
    const git = inspection(checkout);
    const reader: ChangeLinesReader = {
      readHeadLines: (path, from, to, operationSignal) =>
        git.readLines({ path, from, to }, operationSignal),
      readWorktreeText: async (path, operationSignal) =>
        (
          await files.read(
            { worktreeId, root: worktree.path, path },
            operationSignal,
          )
        ).text,
      confirmReachable: async (id, operationSignal) => {
        await worktrees.reachable(id, operationSignal);
      },
    };
    return { environmentId, reader };
  };
}
