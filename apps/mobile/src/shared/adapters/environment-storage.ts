import { SQLiteStorage } from 'expo-sqlite/kv-store';
import {
  getItemAsync,
  setItemAsync,
  deleteItemAsync,
  WHEN_UNLOCKED_THIS_DEVICE_ONLY,
} from 'expo-secure-store';
import { Cause, Effect, Redacted, Schema } from 'effect';
import {
  connectionRoutes,
  type ConnectionRoute,
} from '@porcelain/client/access/rules';
import { EnvironmentStorage } from '@porcelain/client/access';

const metadata = new SQLiteStorage('porcelain-environments.db');
const metadataKey = 'environments';
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

const readMetadata = Effect.fn('EnvironmentStorage.readMetadata')(function* () {
  const value = yield* Effect.tryPromise({
    try: () => metadata.getItemAsync(metadataKey),
    catch: (cause) => new Cause.UnknownError(cause),
  });
  if (value === null) return [];
  return yield* Effect.try({
    try: () => decode(JSON.parse(value)),
    catch: (cause) => new Cause.UnknownError(cause),
  });
});

const readRoute = Effect.fn('EnvironmentStorage.readRoute')(function* (
  route: typeof savedRouteSchema.Type,
) {
  const credential = yield* Effect.tryPromise({
    try: () => getItemAsync(`porcelain.device.${route.deviceId}`),
    catch: (cause) => new Cause.UnknownError(cause),
  });
  if (!credential)
    return yield* Effect.fail(
      new Cause.UnknownError(
        undefined,
        'A saved connection credential could not be read. Pair that connection again.',
      ),
    );
  return {
    address: route.address,
    deviceId: route.deviceId,
    credential: Redacted.make(credential),
  };
});
function savedRoute(route: ConnectionRoute) {
  return { address: route.address, deviceId: route.deviceId };
}

export const environmentStorage = EnvironmentStorage.of({
  read: () =>
    Effect.gen(function* () {
      const saved = yield* readMetadata();
      return yield* Effect.forEach(saved, (remote) =>
        Effect.gen(function* () {
          const primary = yield* readRoute(remote);
          const alternatives = yield* Effect.forEach(
            remote.alternateRoutes ?? [],
            readRoute,
          );
          return {
            environmentId: remote.environmentId,
            name: remote.name,
            ...(remote.operationIdentity
              ? { operationIdentity: remote.operationIdentity }
              : {}),
            ...primary,
            ...(alternatives.length ? { alternateRoutes: alternatives } : {}),
          };
        }),
      );
    }),
  write: (remotes) =>
    Effect.gen(function* () {
      const before = yield* readMetadata();
      const next = yield* Effect.try({
        try: () =>
          decode(
            remotes.map((remote) => ({
              environmentId: remote.environmentId,
              name: remote.name,
              ...(remote.operationIdentity
                ? { operationIdentity: remote.operationIdentity }
                : {}),
              ...savedRoute(remote),
              ...(remote.alternateRoutes?.length
                ? { alternateRoutes: remote.alternateRoutes.map(savedRoute) }
                : {}),
            })),
          ),
        catch: (cause) => new Cause.UnknownError(cause),
      });
      for (const remote of remotes)
        for (const route of connectionRoutes(remote)) {
          if (!route.deviceId)
            return yield* Effect.fail(
              new Cause.UnknownError(
                undefined,
                'The paired connection sent no device identity.',
              ),
            );
          yield* Effect.tryPromise({
            try: () =>
              setItemAsync(
                `porcelain.device.${route.deviceId}`,
                Redacted.value(route.credential),
                { keychainAccessible: WHEN_UNLOCKED_THIS_DEVICE_ONLY },
              ),
            catch: (cause) => new Cause.UnknownError(cause),
          });
        }
      yield* Effect.tryPromise({
        try: () => metadata.setItemAsync(metadataKey, JSON.stringify(next)),
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
              try: () => deleteItemAsync(`porcelain.device.${route.deviceId}`),
              catch: (cause) => new Cause.UnknownError(cause),
            });
    }),
});
