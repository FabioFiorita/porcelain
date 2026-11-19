import { useAtomRefresh } from '@effect/atom-react';
import { Atom, AsyncResult } from 'effect/reactivity';
import { readWalkthroughWriterSettings } from '@porcelain/client/projects';
import type { Connection } from '@/shared/workspace/connection';
import { useMountedRead } from '@/shared/query/mounted-read';

const inactiveWriters = Atom.make(
  AsyncResult.initial<
    Atom.Success<ReturnType<typeof readWalkthroughWriterSettings>>,
    Atom.Failure<ReturnType<typeof readWalkthroughWriterSettings>>
  >(),
);

export function useWalkthroughWriters(
  connection: Connection,
  enabled: boolean,
) {
  const atom = enabled
    ? readWalkthroughWriterSettings(connection)
    : inactiveWriters;
  return {
    result: useMountedRead(atom) ?? AsyncResult.initial(),
    refresh: useAtomRefresh(atom),
  };
}
