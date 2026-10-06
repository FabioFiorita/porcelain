import { Effect, Layer, Option, Schema } from 'effect';
import { SqlClient, SqlSchema } from 'effect/sql';
import { DeviceStore } from '@porcelain/access/ports';
import type { StoredDevice } from '@porcelain/access/models';
import { DeviceRow } from '../../db/models/devices.ts';

function storedDevice({
  lastSeenAddress,
  revokedAt,
  routeInferred,
  trusted,
  ...device
}: DeviceRow): StoredDevice {
  return {
    ...device,
    ...(lastSeenAddress === null ? {} : { lastSeenAddress }),
    ...(routeInferred ? { routeInferred } : {}),
    ...(trusted ? { trusted } : {}),
    ...(revokedAt === null ? {} : { revokedAt }),
  };
}
export const sqliteDeviceStoreLayer = Layer.effect(
  DeviceStore,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const find = SqlSchema.findOneOption({
      Request: Schema.Struct({ deviceId: Schema.String }),
      Result: DeviceRow,
      execute: (input) =>
        sql`SELECT * FROM devices WHERE id = ${input.deviceId}`,
    });
    const list = SqlSchema.findAll({
      Request: Schema.Void,
      Result: DeviceRow,
      execute: () => sql`SELECT * FROM devices ORDER BY created_at`,
    });

    return DeviceStore.of({
      find: Effect.fn('DeviceStore.find')(function* (
        input: Parameters<DeviceStore['find']>[0],
      ) {
        return Option.getOrUndefined(
          Option.map(yield* find(input).pipe(Effect.orDie), storedDevice),
        );
      }),
      list: Effect.fn('DeviceStore.list')(function* () {
        return (yield* list(undefined).pipe(Effect.orDie)).map(storedDevice);
      }),
      markRevoked: Effect.fn('DeviceStore.markRevoked')(function* (
        input: Parameters<DeviceStore['markRevoked']>[0],
      ) {
        yield* sql`UPDATE devices SET revoked_at = ${input.revokedAt} WHERE id = ${input.device.id}`.pipe(
          Effect.orDie,
        );
      }),
      recordSighting: Effect.fn('DeviceStore.recordSighting')(function* (
        input: Parameters<DeviceStore['recordSighting']>[0],
      ) {
        yield* sql`UPDATE devices SET last_seen_at = ${input.device.lastSeenAt}, last_seen_address = ${input.device.lastSeenAddress ?? null} WHERE id = ${input.device.id}`.pipe(
          Effect.orDie,
        );
      }),
      recordTrust: Effect.fn('DeviceStore.recordTrust')(function* (
        input: Parameters<DeviceStore['recordTrust']>[0],
      ) {
        yield* sql`UPDATE devices SET trusted = ${input.trusted ? 1 : 0} WHERE id = ${input.device.id}`.pipe(
          Effect.orDie,
        );
      }),
    });
  }),
);
