import { useAtom } from '@effect/atom-react';
import { Effect } from 'effect';
import { Atom } from 'effect/reactivity';
import { disconnectBrowserSession } from '@porcelain/client/access';
import type { Connection } from '@/shared/workspace/connection';
import { accessSession } from '../store';

const disconnectAndClear = Atom.family((connection: Connection) =>
  Atom.fn((_: void, get) =>
    Effect.gen(function* () {
      yield* get.setResult(disconnectBrowserSession(connection), undefined);
      accessSession.clear();
    }),
  ),
);

export function useDisconnect(connection: Connection) {
  const [result, run] = useAtom(disconnectAndClear(connection), {
    mode: 'promiseExit',
  });
  return {
    result,
    submit: () => {
      void run();
    },
  };
}
