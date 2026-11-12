import { Effect } from 'effect';
import { useAtom } from '@effect/atom-react';
import { randomUUID } from 'expo-crypto';
import {
  AccessStore,
  EnvironmentCommands,
  EnvironmentMutations,
} from '@porcelain/client/access';
import { clientRuntime } from '../../../shared/application/store';
import { demoRemote } from '../../../shared/adapters/demo-data';

const demo = clientRuntime.fn((action: 'start' | 'reset' | 'exit') =>
  Effect.gen(function* () {
    const commands = yield* EnvironmentCommands;
    if (action !== 'start') yield* commands.forget(demoRemote.environmentId);
    if (action === 'exit') return;
    const access = yield* AccessStore;
    const mutations = yield* EnvironmentMutations;
    yield* mutations.run(
      'access',
      access.save({ ...demoRemote, deviceId: randomUUID() }),
    );
  }),
);

export function useDemo() {
  const [result, run] = useAtom(demo);
  return { result, run, environmentId: demoRemote.environmentId };
}
