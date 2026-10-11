import { Atom } from 'effect/reactivity';
import type { WorktreeSelection } from '../../../shared/api/connection.ts';
import { clientWorktreeRead } from '../../../shared/api/worktree-read.ts';
export const readWorktreePaths = Atom.family((selection: WorktreeSelection) =>
  clientWorktreeRead(
    selection,
    ['paths'],
    (api) =>
      api.files.listWorktreePaths({
        params: { worktreeId: selection.scope.worktreeId },
      }),
    (answer) => answer.worktreeId === selection.scope.worktreeId,
  ),
);
