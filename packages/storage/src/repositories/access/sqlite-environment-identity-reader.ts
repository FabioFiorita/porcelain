import { Effect, Layer, Option, Schema } from 'effect';
import { SqlClient, SqlSchema } from 'effect/sql';
import { EnvironmentIdentityReader } from '@porcelain/access/ports';

import { EnvironmentRow } from '../../db/models/environment.ts';

export const sqliteEnvironmentIdentityReaderLayer = Layer.effect(
  EnvironmentIdentityReader,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const read = SqlSchema.findOneOption({
      Request: Schema.Void,
      Result: EnvironmentRow,
      execute: () => sql`SELECT * FROM environment WHERE singleton = 1`,
    });

    return EnvironmentIdentityReader.of({
      environmentId: Effect.fn('EnvironmentIdentityReader.environmentId')(
        function* () {
          return Option.getOrUndefined(
            Option.map(
              yield* read(undefined).pipe(Effect.orDie),
              (row) => row.id,
            ),
          );
        },
      ),
    });
  }),
);
