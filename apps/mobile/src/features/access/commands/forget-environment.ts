import { Effect } from 'effect';
import { Atom } from 'effect/reactivity';
import { useAtom } from '@effect/atom-react';
import { EnvironmentCommands } from '@porcelain/client/access';
import type { Remote } from '@porcelain/client/access/rules';
import { syncPushRegistration } from '@porcelain/client/notifications';
import {
  clientRuntime,
  remoteConnectionState,
} from '../../../shared/application/store';

const PUSH_CLEAR_TIMEOUT_MS = 3000;

const forgetEnvironment = Atom.family((environmentId: string) =>
  clientRuntime.fn((_: void, get) =>
    Effect.gen(function* () {
      const entry = remoteConnectionState.value.find(
        ({ remote }) => remote.environmentId === environmentId,
      );
      if (entry)
        yield* get
          .setResult(syncPushRegistration(entry.connection), { kind: 'clear' })
          .pipe(Effect.timeout(PUSH_CLEAR_TIMEOUT_MS), Effect.ignore);
      const commands = yield* EnvironmentCommands;
      yield* commands.forget(environmentId);
    }),
  ),
);

export function useForgetEnvironment(remote: Pick<Remote, 'environmentId'>) {
  const [result, run] = useAtom(forgetEnvironment(remote.environmentId));
  return { result, forget: () => run(undefined) };
}
