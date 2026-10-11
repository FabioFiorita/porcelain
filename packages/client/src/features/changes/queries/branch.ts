import { Atom } from 'effect/reactivity';
import type { WorktreeSelection } from '../../../shared/api/connection.ts';
import { clientWorktreeRead } from '../../../shared/api/worktree-read.ts';
export const readBranchChanges = Atom.family(
  (selection: WorktreeSelection & { base?: string }) =>
    clientWorktreeRead(
      selection,
      ['branch', selection.base ?? null],
      (api) =>
        api.changes.readBranchChanges({
          params: { worktreeId: selection.scope.worktreeId },
          query: { base: selection.base },
        }),
      (answer) => answer.worktreeId === selection.scope.worktreeId,
    ),
);
export const readBranchBases = Atom.family((selection: WorktreeSelection) =>
  clientWorktreeRead(selection, ['branch-bases'], (api) =>
    api.changes.listBranchBases({
      params: { worktreeId: selection.scope.worktreeId },
    }),
  ),
);
