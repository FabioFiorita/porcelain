import { Atom } from 'effect/reactivity';
import type {
  RuntimeConnection,
  WorktreeScope,
} from '../../../shared/api/connection.ts';
import { clientWorktreeRead } from '../../../shared/api/worktree-read.ts';
import type { FilesScope } from '../rules/scope.ts';

export const readDirectory = Atom.family(
  ({
    connection,
    scope,
    path,
  }: {
    connection: RuntimeConnection;
    scope: WorktreeScope;
    path: string;
  }) =>
    clientWorktreeRead(
      { connection, scope },
      ['directory', path],
      (api) =>
        api.files.listDirectory({
          params: { worktreeId: scope.worktreeId },
          query: { path },
        }),
      (answer) => answer.worktreeId === scope.worktreeId,
      [path],
    ),
);

export type DirectorySelection = {
  connection: RuntimeConnection;
  scope: FilesScope;
  paths: readonly string[];
};
function directoryAtoms({ connection, scope, paths }: DirectorySelection) {
  return paths.map((path) => readDirectory({ connection, scope, path }));
}
export const readDirectories = Atom.family((selection: DirectorySelection) =>
  Atom.make((get) => directoryAtoms(selection).map((atom) => get(atom))),
);
export const refreshDirectories = Atom.family((selection: DirectorySelection) =>
  Atom.fnSync((_: void, get) => {
    for (const atom of directoryAtoms(selection)) get.refresh(atom);
  }),
);
