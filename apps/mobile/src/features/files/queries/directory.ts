import { useAtomSet, useAtomValue } from '@effect/atom-react';
import { Atom } from 'effect/reactivity';
import { readDirectory } from '@porcelain/client/files';
import type { RuntimeConnection } from '@porcelain/client/transport';
import type { FilesScope } from '@porcelain/client/files/rules';

type Selection = {
  connection: RuntimeConnection;
  scope: FilesScope;
  paths: readonly string[];
};
const reads = Atom.family((selection: Selection) =>
  Atom.make((get) =>
    selection.paths.map((path) => get(readDirectory({ ...selection, path }))),
  ),
);
const refresh = Atom.family((selection: Selection) =>
  Atom.fnSync((_: void, get) => {
    for (const path of selection.paths)
      get.refresh(readDirectory({ ...selection, path }));
  }),
);
export function useDirectories(selection: Selection) {
  const run = useAtomSet(refresh(selection));
  return {
    results: useAtomValue(reads(selection)),
    refresh: () => run(undefined),
  };
}
