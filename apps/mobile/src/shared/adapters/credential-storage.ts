import { Cause, Effect, Redacted, Schema } from 'effect';
import {
  connectionRoutes,
  type ConnectionRoute,
  operationJournalKey,
  type Remote,
} from '@porcelain/client/access/rules';
import {
  EnvironmentStorage,
  type MissingCredentialRemote,
} from '@porcelain/client/access';

export type CredentialStorageHost = {
  readonly readMetadata: () => Promise<string | null>;
  readonly writeMetadata: (value: string) => Promise<void>;
  readonly readCredential: (deviceId: string) => Promise<string | null>;
  readonly writeCredential: (deviceId: string, value: string) => Promise<void>;
  readonly forgetCredential: (deviceId: string) => Promise<void>;
  readonly developmentFixtures: () => boolean;
};
const savedRouteSchema = Schema.Struct({
  address: Schema.String.check(
    Schema.makeFilter((value) => URL.canParse(value)),
  ),
  deviceId: Schema.String.check(Schema.isMinLength(1)),
});
const savedEnvironmentSchema = Schema.Array(
  Schema.Struct({
    ...savedRouteSchema.fields,
    environmentId: Schema.String.check(Schema.isMinLength(1)),
    name: Schema.String,
    alternateRoutes: Schema.optional(Schema.Array(savedRouteSchema)),
    operationIdentity: Schema.optional(Schema.String),
  }),
);
const decode = Schema.decodeUnknownSync(savedEnvironmentSchema);

export function createEnvironmentStorage(host: CredentialStorageHost) {
  const readMetadata = Effect.fn('EnvironmentStorage.readMetadata')(
    function* () {
      const value = yield* Effect.tryPromise({
        try: () => host.readMetadata(),
        catch: (cause) => new Cause.UnknownError(cause),
      });
      if (value === null) return [];
      return yield* Effect.try({
        try: () => decode(JSON.parse(value)),
        catch: (cause) => new Cause.UnknownError(cause),
      });
    },
  );

  const readRoute = Effect.fn('EnvironmentStorage.readRoute')(function* (
    route: typeof savedRouteSchema.Type,
  ) {
    const credential = yield* Effect.tryPromise({
      try: () => host.readCredential(route.deviceId),
      catch: (cause) => new Cause.UnknownError(cause),
    });
    if (!credential) return undefined;
    return {
      address: route.address,
      deviceId: route.deviceId,
      credential: Redacted.make(credential),
    };
  });
  function savedRoute(route: Pick<ConnectionRoute, 'address' | 'deviceId'>) {
    return { address: route.address, deviceId: route.deviceId };
  }

  const storage = EnvironmentStorage.of({
    read: () =>
      Effect.gen(function* () {
        const saved = yield* readMetadata();
        const remotes: Remote[] = [];
        const missingCredentials: MissingCredentialRemote[] = [];
        for (const remote of saved) {
          const routes = [remote, ...(remote.alternateRoutes ?? [])];
          const available: ConnectionRoute[] = [];
          const missing: MissingCredentialRemote['routes'][number][] = [];
          for (const route of routes) {
            const loaded = yield* readRoute(route);
            if (loaded) available.push(loaded);
            else missing.push(savedRoute(route));
          }
          const operationIdentity =
            remote.operationIdentity ??
            JSON.stringify([
              remote.environmentId,
              remote.address,
              remote.deviceId,
            ]);
          const [primary, ...alternatives] = available;
          if (primary)
            remotes.push({
              environmentId: remote.environmentId,
              name: remote.name,
              operationIdentity,
              ...primary,
              ...(alternatives.length ? { alternateRoutes: alternatives } : {}),
            });
          if (missing.length)
            missingCredentials.push({
              environmentId: remote.environmentId,
              name: remote.name,
              operationIdentity,
              routes: missing,
            });
        }
        return { remotes, missingCredentials };
      }),
    write: ({ remotes, missingCredentials }) =>
      Effect.gen(function* () {
        const before = yield* readMetadata();
        const next = yield* Effect.try({
          try: () =>
            decode(
              [
                ...new Set(
                  [...remotes, ...missingCredentials].map(
                    (remote) => remote.environmentId,
                  ),
                ),
              ].map((environmentId) => {
                const remote = remotes.find(
                  (entry) => entry.environmentId === environmentId,
                );
                const missing = missingCredentials.find(
                  (entry) => entry.environmentId === environmentId,
                );
                const routes = [
                  ...(remote ? connectionRoutes(remote).map(savedRoute) : []),
                  ...(missing?.routes ?? []),
                ];
                const [primary, ...alternatives] = routes;
                return {
                  environmentId,
                  name: remote?.name ?? missing?.name,
                  operationIdentity: remote
                    ? operationJournalKey(remote)
                    : missing?.operationIdentity,
                  ...primary,
                  ...(alternatives.length
                    ? { alternateRoutes: alternatives }
                    : {}),
                };
              }),
            ),
          catch: (cause) => new Cause.UnknownError(cause),
        });
        for (const remote of remotes)
          for (const route of connectionRoutes(remote)) {
            const deviceId = route.deviceId;
            if (!deviceId)
              return yield* Effect.fail(
                new Cause.UnknownError(
                  undefined,
                  'The paired connection sent no device identity.',
                ),
              );
            const existing = yield* Effect.tryPromise({
              try: () => host.readCredential(deviceId),
              catch: (cause) => new Cause.UnknownError(cause),
            });
            if (existing && existing !== Redacted.value(route.credential))
              return yield* Effect.fail(
                new Cause.UnknownError(
                  undefined,
                  'A saved credential cannot be replaced.',
                ),
              );
            if (existing) continue;
            yield* Effect.tryPromise({
              try: () =>
                host.writeCredential(
                  deviceId,
                  Redacted.value(route.credential),
                ),
              catch: (cause) => new Cause.UnknownError(cause),
            });
          }
        yield* Effect.tryPromise({
          try: () => host.writeMetadata(JSON.stringify(next)),
          catch: (cause) => new Cause.UnknownError(cause),
        });
        const kept = new Set(
          next.flatMap((remote) => [
            remote.deviceId,
            ...(remote.alternateRoutes ?? []).map((route) => route.deviceId),
          ]),
        );
        for (const old of before)
          for (const route of [old, ...(old.alternateRoutes ?? [])])
            if (!kept.has(route.deviceId))
              yield* Effect.tryPromise({
                try: () => host.forgetCredential(route.deviceId),
                catch: (cause) => new Cause.UnknownError(cause),
              });
      }),
  });

  const removeDevelopmentCredential = Effect.fn(
    'EnvironmentStorage.removeDevelopmentCredential',
  )(function* (deviceId: string) {
    if (!host.developmentFixtures())
      return yield* Effect.fail(
        new Cause.UnknownError(
          undefined,
          'Credential fixtures require a disposable development profile.',
        ),
      );
    const saved = yield* readMetadata();
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

  return { storage, removeDevelopmentCredential };
}
