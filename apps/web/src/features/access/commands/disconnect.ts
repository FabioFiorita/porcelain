import { useAtom } from '@effect/atom-react';
import { Effect } from 'effect';
import { Atom } from 'effect/reactivity';
import {
  AccessSession,
  disconnectBrowserSession,
} from '@porcelain/client/access';
import type { Connection } from '@/shared/workspace/connection';
import { environmentRuntime } from '../store';

const disconnectAndClear = Atom.family((connection: Connection) =>
  environmentRuntime.fn((_: void, get) =>
    Effect.gen(function* () {
      yield* get.setResult(disconnectBrowserSession(connection), undefined);
      const session = yield* AccessSession;
      yield* session.clear();
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
