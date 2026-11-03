import { Effect, Layer, Schema } from 'effect';
import { SqlClient, SqlSchema } from 'effect/sql';
import { pushKindSchema } from '@porcelain/access/models';
import { PushRegistrationStore } from '@porcelain/access/ports';
import { PushRegistrationRow } from '../../db/models/push-registrations.ts';

const kindsJson = Schema.fromJsonString(Schema.Array(pushKindSchema));

export const sqlitePushRegistrationStoreLayer = Layer.effect(
  PushRegistrationStore,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const list = SqlSchema.findAll({
      Request: Schema.Void,
      Result: PushRegistrationRow,
      execute: () => sql`SELECT * FROM push_registrations ORDER BY device_id`,
    });

    return PushRegistrationStore.of({
      list: Effect.fn('PushRegistrationStore.list')(function* () {
        const rows = yield* list(undefined).pipe(Effect.orDie);
        return rows.map((row) => ({
          deviceId: row.deviceId,
          token: row.token,
          platform: row.platform,
          kinds: row.kinds,
        }));
      }),
      save: Effect.fn('PushRegistrationStore.save')(function* (
        registration: Parameters<PushRegistrationStore['save']>[0],
      ) {
        const kinds = yield* Schema.encodeEffect(kindsJson)(
          registration.kinds,
        ).pipe(Effect.orDie);
        yield* sql`INSERT INTO push_registrations (device_id, token, platform, kinds) VALUES (${registration.deviceId}, ${registration.token}, ${registration.platform}, ${kinds}) ON CONFLICT (device_id) DO UPDATE SET token = excluded.token, platform = excluded.platform, kinds = excluded.kinds`.pipe(
          Effect.orDie,
        );
      }),
      remove: Effect.fn('PushRegistrationStore.remove')(function* (
        key: Parameters<PushRegistrationStore['remove']>[0],
      ) {
        yield* sql`DELETE FROM push_registrations WHERE device_id = ${key.deviceId}`.pipe(
          Effect.orDie,
        );
      }),
    });
  }),
);
