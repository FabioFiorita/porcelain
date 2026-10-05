import { Effect, Layer, Option, Schema } from 'effect';
import { SqlClient, SqlSchema } from 'effect/sql';
import { RemoteAccessStore } from '@porcelain/access/ports';

import { RemoteAccessRow } from '../../db/models/remote-access.ts';

export const sqliteRemoteAccessStoreLayer = Layer.effect(
  RemoteAccessStore,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const read = SqlSchema.findOneOption({
      Request: Schema.Void,
      Result: RemoteAccessRow,
      execute: () => sql`SELECT * FROM remote_access WHERE singleton = 1`,
    });

    return RemoteAccessStore.of({
      read: Effect.fn('RemoteAccessStore.read')(function* () {
        const result = yield* read(undefined).pipe(Effect.orDie);
        if (Option.isNone(result))
          return { lan: false, tailnet: false, cloudflare: false };
        const row = result.value;
        return {
          lan: row.lan,
          ...(row.lanInterface === null ||
          row.lanSubnet === null ||
          row.lanGateway === null
            ? {}
            : {
                lanNetwork: {
                  interfaceName: row.lanInterface,
                  subnet: row.lanSubnet,
                  gateway: row.lanGateway,
                  ...(row.lanGatewayHardware === null
                    ? {}
                    : { gatewayHardware: row.lanGatewayHardware }),
                },
              }),
          tailnet: row.tailnet,
          ...(row.tailnetHostname === null
            ? {}
            : { tailnetHostname: row.tailnetHostname }),
          ...(row.tailnetPort === null ? {} : { tailnetPort: row.tailnetPort }),
          cloudflare: row.cloudflare,
          ...(row.cloudflareHostname === null
            ? {}
            : { cloudflareHostname: row.cloudflareHostname }),
        };
      }),
      save: Effect.fn('RemoteAccessStore.save')(function* (
        input: Parameters<RemoteAccessStore['save']>[0],
      ) {
        return yield* Effect.gen(function* () {
          const row = yield* Schema.encodeEffect(RemoteAccessRow.insert)({
            singleton: 1,
            lan: input.lan,
            lanInterface: input.lanNetwork?.interfaceName ?? null,
            lanSubnet: input.lanNetwork?.subnet ?? null,
            lanGateway: input.lanNetwork?.gateway ?? null,
            lanGatewayHardware: input.lanNetwork?.gatewayHardware ?? null,
            tailnet: input.tailnet,
            tailnetHostname: input.tailnetHostname ?? null,
            tailnetPort: input.tailnetPort ?? null,
            cloudflare: input.cloudflare,
            cloudflareHostname: input.cloudflareHostname ?? null,
          });
          yield* sql`INSERT INTO remote_access ${sql.insert(row)} ON CONFLICT (singleton) DO UPDATE SET ${sql.update(row, ['singleton'])}`;
        }).pipe(sql.withTransaction, Effect.asVoid, Effect.orDie);
      }),
    });
  }),
);
