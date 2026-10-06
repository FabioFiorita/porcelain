import { readChangeLines } from '@porcelain/client/changes';
import { useAtomValue } from '@effect/atom-react';
import { Atom, AsyncResult } from 'effect/reactivity';
import type { ChangesScope } from '@porcelain/client/changes/rules';
import type { Connection } from '@/shared/workspace/connection';

const inactiveLines = Atom.make(AsyncResult.success(undefined));
export function useChangeLines(
  scope: ChangesScope,
  connection: Connection,
  path: string,
  from: number,
  to: number,
  enabled: boolean,
) {
  type Read = ReturnType<typeof readChangeLines>;
  const state: Atom.Atom<
    AsyncResult.AsyncResult<Atom.Success<Read> | undefined, Atom.Failure<Read>>
  > = enabled
    ? readChangeLines({ connection, scope, path, from, to })
    : inactiveLines;
  return useAtomValue(state);
}
