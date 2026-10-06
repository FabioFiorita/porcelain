import { useAtomSet, useAtomSuspense, useAtomValue } from '@effect/atom-react';
import { Atom } from 'effect/reactivity';
import { readDirectory } from '@porcelain/client/files';
import type { FilesScope } from '@porcelain/client/files/rules';
import { type Connection } from '@/shared/workspace/connection';

type DirectorySelection = {
  connection: Connection;
  scope: FilesScope;
  paths: readonly string[];
};
const directoryReads = Atom.family((selection: DirectorySelection) =>
  Atom.make((get) =>
    selection.paths.map((path) => get(readDirectory({ ...selection, path }))),
  ),
);
const retryDirectories = Atom.family((selection: DirectorySelection) =>
  Atom.fnSync((_: void, get) => {
    for (const path of selection.paths)
      get.refresh(readDirectory({ ...selection, path }));
    return null;
  }),
);

export function useDirectory(
  connection: Connection,
  scope: FilesScope,
  path: string,
) {
  return useAtomSuspense(readDirectory({ connection, scope, path })).value;
}
export function useDirectories(
  connection: Connection,
  scope: FilesScope,
  paths: readonly string[],
) {
  const selection = { connection, scope, paths };
  const results = useAtomValue(directoryReads(selection));
  const retry = useAtomSet(retryDirectories(selection));
  return { results, retry };
}
