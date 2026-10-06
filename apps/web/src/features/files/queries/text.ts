import { useAtomSet, useAtomValue } from '@effect/atom-react';
import { useConfirmedRead } from '@/shared/query/confirmed-read';
import { Atom, AsyncResult } from 'effect/reactivity';
import { Option } from 'effect';
import { readTextFile } from '@porcelain/client/files';
import type { FilesScope } from '@porcelain/client/files/rules';
import { type Connection } from '@/shared/workspace/connection';

type TextSelection = {
  connection: Connection;
  scope: FilesScope;
  paths: readonly string[];
};
const textReads = Atom.family((selection: TextSelection) =>
  Atom.make((get) =>
    selection.paths.map((path) => get(readTextFile({ ...selection, path }))),
  ),
);
const retryText = Atom.family((selection: TextSelection) =>
  Atom.fnSync((_: void, get) => {
    for (const path of selection.paths)
      get.refresh(readTextFile({ ...selection, path }));
    return null;
  }),
);

export function useTextFile(
  connection: Connection,
  scope: FilesScope,
  path: string,
) {
  return useConfirmedRead(readTextFile({ connection, scope, path })).value;
}
export function useTextContents(
  connection: Connection,
  scope: FilesScope,
  paths: readonly string[],
) {
  const selection = { connection, scope, paths };
  const results = useAtomValue(textReads(selection));
  const retry = useAtomSet(retryText(selection));
  return {
    contents: new Map(
      paths.flatMap((path, index) => {
        const result = results[index];
        const data = result
          ? Option.getOrUndefined(AsyncResult.value(result))
          : undefined;
        return data && 'text' in data ? [[path, data.text] as const] : [];
      }),
    ),
    pending: results.some(AsyncResult.isInitial),
    failed: results.some(AsyncResult.isFailure),
    retry,
  };
}
