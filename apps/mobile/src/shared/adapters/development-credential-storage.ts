import { Cause, Effect } from 'effect';
import {
  readCredentialMetadata,
  type CredentialStorageHost,
} from './credential-storage';

export function createDevelopmentCredentialRemoval(
  host: CredentialStorageHost,
  developmentFixtures: () => boolean,
) {
  return Effect.fn('EnvironmentStorage.removeDevelopmentCredential')(function* (
    deviceId: string,
  ) {
    if (!developmentFixtures())
      return yield* Effect.fail(
        new Cause.UnknownError(
          undefined,
          'Credential fixtures require a disposable development profile.',
        ),
      );
    const saved = yield* readCredentialMetadata(host);
    const route = saved
      .flatMap((remote) => [remote, ...(remote.alternateRoutes ?? [])])
      .find((entry) => entry.deviceId === deviceId);
    if (!route || URL.parse(route.address)?.hostname !== '10.0.2.2')
      return yield* Effect.fail(
        new Cause.UnknownError(
          undefined,
          'Only an emulator fixture credential can be removed.',
        ),
      );
    yield* Effect.tryPromise({
      try: () => host.forgetCredential(deviceId),
      catch: (cause) => new Cause.UnknownError(cause),
    });
  });
}
