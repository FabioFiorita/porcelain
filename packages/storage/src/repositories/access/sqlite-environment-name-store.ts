import { Effect, Layer, Option, Schema } from 'effect';
import { SqlClient, SqlSchema } from 'effect/sql';
import { EnvironmentNameStore } from '@porcelain/access/ports';

import { EnvironmentNameRow } from '../../db/models/environment-name.ts';

export const sqliteEnvironmentNameStoreLayer = Layer.effect(
  EnvironmentNameStore,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const read = SqlSchema.findOneOption({
      Request: Schema.Void,
      Result: EnvironmentNameRow,
      execute: () => sql`SELECT * FROM environment_name WHERE singleton = 1`,
    });

    return EnvironmentNameStore.of({
      read: Effect.fn('EnvironmentNameStore.read')(function* () {
        return {
          name: Option.getOrUndefined(
            Option.map(
              yield* read(undefined).pipe(Effect.orDie),
              (row) => row.name,
            ),
          ),
        };
      }),
      save: Effect.fn('EnvironmentNameStore.save')(function* (
        input: Parameters<EnvironmentNameStore['save']>[0],
      ) {
        if (input.name === undefined) {
          yield* sql`DELETE FROM environment_name`.pipe(Effect.orDie);
          return;
        }
        yield* sql`INSERT INTO environment_name (singleton, name) VALUES (1, ${input.name}) ON CONFLICT (singleton) DO UPDATE SET name = excluded.name`.pipe(
          Effect.orDie,
        );
      }),
    });
  }),
);
