import { Atom } from 'effect/reactivity';
import { useAtom, useAtomSet } from '@effect/atom-react';
import { Effect, Exit } from 'effect';
import { useState } from 'react';
import {
  EnvironmentCommands,
  readRemoteStatus,
} from '@porcelain/client/access';
import type { Remote } from '@porcelain/client/access/rules';
import { REQUEST_TIMEOUT_MS } from '@/config/limits';
import { accessSession, environmentRuntime, pairingPlatform } from '../store';

const addRemote = Atom.family((_identity: symbol) =>
  environmentRuntime.fn((value: string, get) =>
    Effect.gen(function* () {
      const commands = yield* EnvironmentCommands;
      const remote = yield* commands
        .pair({
          value,
          localEnvironmentId:
            accessSession.state.value.connection?.environmentId,
        })
        .pipe(Effect.timeout(REQUEST_TIMEOUT_MS));
      get.registry.refresh(readRemoteStatus(pairingPlatform, remote));
      return remote;
    }),
  ),
);
const forgetRemote = Atom.family((remote: Remote) =>
  environmentRuntime.fn((_: void) =>
    Effect.gen(function* () {
      const commands = yield* EnvironmentCommands;
      yield* commands.forget(remote.environmentId);
    }),
  ),
);
const readSavedEnvironments = environmentRuntime.fn((_: void) =>
  Effect.gen(function* () {
    const commands = yield* EnvironmentCommands;
    yield* commands.read();
  }),
);
const recheckRemote = Atom.fn((remote: Remote, get) =>
  Effect.sync(() => {
    get.registry.refresh(readRemoteStatus(pairingPlatform, remote));
  }),
);

export function useAddRemote(onAdded: () => void) {
  const [identity] = useState(Symbol);
  const command = addRemote(identity);
  const [result, run] = useAtom(command, { mode: 'promiseExit' });
  const reset = useAtomSet(command);
  return {
    result,
    submit: async (value: string) => {
      const exit = await run(value);
      if (Exit.isSuccess(exit)) onAdded();
    },
    reset: () => reset(Atom.Reset),
  };
}

export function useForgetRemote(remote: Remote) {
  const [result, submit] = useAtom(forgetRemote(remote));
  return { result, submit: () => submit(undefined) };
}

export function useRecheckRemote() {
  return useAtomSet(recheckRemote);
}

export function useReadSavedEnvironments() {
  const [result, read] = useAtom(readSavedEnvironments);
  return { result, read: () => read(undefined) };
}
