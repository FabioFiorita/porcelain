import { Effect, Layer, Option, Schema } from 'effect';
import { SqlClient, SqlSchema } from 'effect/sql';
import { EnvironmentLabelStore } from '@porcelain/access/ports';

import { EnvironmentIconRow } from '../../db/models/environment-icon.ts';
import { EnvironmentNameRow } from '../../db/models/environment-name.ts';

export const sqliteEnvironmentLabelStoreLayer = Layer.effect(
  EnvironmentLabelStore,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const readName = SqlSchema.findOneOption({
      Request: Schema.Void,
      Result: EnvironmentNameRow,
      execute: () => sql`SELECT * FROM environment_name WHERE singleton = 1`,
    });
    const readIcon = SqlSchema.findOneOption({
      Request: Schema.Void,
      Result: EnvironmentIconRow,
      execute: () => sql`SELECT * FROM environment_icon WHERE singleton = 1`,
    });

    return EnvironmentLabelStore.of({
      read: Effect.fn('EnvironmentLabelStore.read')(function* () {
        return yield* Effect.gen(function* () {
          const name = yield* readName(undefined);
          const icon = yield* readIcon(undefined);
          return {
            name: Option.getOrUndefined(Option.map(name, (row) => row.name)),
            icon: Option.getOrUndefined(Option.map(icon, (row) => row.icon)),
          };
        }).pipe(sql.withTransaction, Effect.orDie);
      }),
      save: Effect.fn('EnvironmentLabelStore.save')(function* (
        input: Parameters<EnvironmentLabelStore['save']>[0],
      ) {
        yield* Effect.gen(function* () {
          yield* input.name === undefined
            ? sql`DELETE FROM environment_name`
            : sql`INSERT INTO environment_name (singleton, name) VALUES (1, ${input.name}) ON CONFLICT (singleton) DO UPDATE SET name = excluded.name`;
          yield* input.icon === undefined
            ? sql`DELETE FROM environment_icon`
            : sql`INSERT INTO environment_icon (singleton, icon) VALUES (1, ${input.icon}) ON CONFLICT (singleton) DO UPDATE SET icon = excluded.icon`;
        }).pipe(sql.withTransaction, Effect.orDie);
      }),
    });
  }),
);
