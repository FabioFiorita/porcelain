import { Effect } from 'effect';
import { Atom } from 'effect/reactivity';
import { useAtom } from '@effect/atom-react';
import { EnvironmentCommands } from '@porcelain/client/access';
import { clientRuntime } from '../../../shared/application/store';
import { environmentStorageHost } from '../../../shared/adapters/environment-storage';
import { createDevelopmentCredentialRemoval } from '../../../shared/adapters/development-credential-storage';
import { developmentPairingUrl } from '../api';

const removeDevelopmentCredential = createDevelopmentCredentialRemoval(
  environmentStorageHost,
  () => __DEV__ && Boolean(developmentPairingUrl),
);

const removeCredential = Atom.family((deviceId: string) =>
  clientRuntime.fn((_: void) =>
    Effect.gen(function* () {
      yield* removeDevelopmentCredential(deviceId);
      const commands = yield* EnvironmentCommands;
      yield* commands.read();
    }),
  ),
);

export function useRemoveDevelopmentCredential(deviceId: string) {
  const [result, run] = useAtom(removeCredential(deviceId));
  return { result, remove: () => run(undefined) };
}
