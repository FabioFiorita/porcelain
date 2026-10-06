import { Effect, Layer, Option, Schema } from 'effect';
import { SqlClient, SqlSchema } from 'effect/sql';
import { PairingGrantStore } from '@porcelain/access/ports';
import type { StoredPairingGrant } from '@porcelain/access/models';
import { PairingGrantRow } from '../../db/models/pairing-grants.ts';
import { DeviceRow } from '../../db/models/devices.ts';

function storedGrant({
  redeemedAt,
  revokedAt,
  trusted,
  ...grant
}: PairingGrantRow): StoredPairingGrant {
  return {
    ...grant,
    ...(trusted ? { trusted } : {}),
    ...(redeemedAt === null ? {} : { redeemedAt }),
    ...(revokedAt === null ? {} : { revokedAt }),
  };
}
export const sqlitePairingGrantStoreLayer = Layer.effect(
  PairingGrantStore,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const find = SqlSchema.findOneOption({
      Request: Schema.Struct({ grantId: Schema.String }),
      Result: PairingGrantRow,
      execute: (input) =>
        sql`SELECT * FROM pairing_grants WHERE id = ${input.grantId}`,
    });
    const list = SqlSchema.findAll({
      Request: Schema.Void,
      Result: PairingGrantRow,
      execute: () => sql`SELECT * FROM pairing_grants ORDER BY created_at`,
    });

    return PairingGrantStore.of({
      find: Effect.fn('PairingGrantStore.find')(function* (
        input: Parameters<PairingGrantStore['find']>[0],
      ) {
        return Option.getOrUndefined(
          Option.map(yield* find(input).pipe(Effect.orDie), storedGrant),
        );
      }),
      list: Effect.fn('PairingGrantStore.list')(function* () {
        return (yield* list(undefined).pipe(Effect.orDie)).map(storedGrant);
      }),
      add: Effect.fn('PairingGrantStore.add')(function* (
        input: Parameters<PairingGrantStore['add']>[0],
      ) {
        return yield* Effect.gen(function* () {
          for (const grant of input.grants) {
            const row = yield* Schema.encodeEffect(PairingGrantRow.insert)({
              ...grant,
              trusted: grant.trusted === true,
              redeemedAt: grant.redeemedAt ?? null,
              revokedAt: grant.revokedAt ?? null,
            });
            yield* sql`INSERT INTO pairing_grants ${sql.insert(row)}`;
          }
        }).pipe(sql.withTransaction, Effect.asVoid, Effect.orDie);
      }),
      markRevoked: Effect.fn('PairingGrantStore.markRevoked')(function* (
        input: Parameters<PairingGrantStore['markRevoked']>[0],
      ) {
        yield* sql`UPDATE pairing_grants SET revoked_at = ${input.revokedAt} WHERE id = ${input.grant.id}`.pipe(
          Effect.orDie,
        );
      }),
      redeem: Effect.fn('PairingGrantStore.redeem')(function* (
        input: Parameters<PairingGrantStore['redeem']>[0],
      ) {
        return yield* Effect.gen(function* () {
          yield* sql`UPDATE pairing_grants SET redeemed_at = ${input.redeemedAt} WHERE id = ${input.grant.id}`;
          const device = input.device;
          const row = yield* Schema.encodeEffect(DeviceRow.insert)({
            ...device,
            lastSeenAddress: device.lastSeenAddress ?? null,
            routeInferred: device.routeInferred === true,
            trusted: device.trusted === true,
            revokedAt: device.revokedAt ?? null,
          });
          yield* sql`INSERT INTO devices ${sql.insert(row)}`;
        }).pipe(sql.withTransaction, Effect.asVoid, Effect.orDie);
      }),
    });
  }),
);
