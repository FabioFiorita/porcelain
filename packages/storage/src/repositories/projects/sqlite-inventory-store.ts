import { Effect, Layer, Option, Schema } from 'effect';
import { SqlClient, SqlSchema } from 'effect/sql';
import { InventoryStore } from '@porcelain/projects/ports';

import { InventoryProjectRow } from '../../db/models/inventory-projects.ts';

export const sqliteInventoryStoreLayer = Layer.effect(
  InventoryStore,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const all = SqlSchema.findAll({
      Request: Schema.Void,
      Result: InventoryProjectRow,
      execute: () => sql`SELECT * FROM inventory_projects ORDER BY position`,
    });
    const find = SqlSchema.findOneOption({
      Request: Schema.Struct({ projectId: Schema.String }),
      Result: InventoryProjectRow,
      execute: (input) =>
        sql`SELECT * FROM inventory_projects WHERE id = ${input.projectId}`,
    });

    return InventoryStore.of({
      markAllUnavailable: Effect.fn('InventoryStore.markAllUnavailable')(
        function* () {
          yield* sql`UPDATE inventory_projects SET available = 0`.pipe(
            Effect.orDie,
          );
        },
      ),
      read: Effect.fn('InventoryStore.read')(function* () {
        return { projects: yield* all(undefined).pipe(Effect.orDie) };
      }),
      find: Effect.fn('InventoryStore.find')(function* (
        input: Parameters<InventoryStore['find']>[0],
      ) {
        return Option.getOrUndefined(yield* find(input).pipe(Effect.orDie));
      }),
      save: Effect.fn('InventoryStore.save')(function* (
        input: Parameters<InventoryStore['save']>[0],
      ) {
        return yield* Effect.gen(function* () {
          const row = yield* Schema.encodeEffect(InventoryProjectRow.insert)(
            input,
          );
          yield* sql`INSERT INTO inventory_projects ${sql.insert(row)} ON CONFLICT (id) DO UPDATE SET ${sql.update(row, ['id'])}`;
        }).pipe(sql.withTransaction, Effect.asVoid, Effect.orDie);
      }),
      remove: Effect.fn('InventoryStore.remove')(function* (
        input: Parameters<InventoryStore['remove']>[0],
      ) {
        yield* sql`DELETE FROM inventory_projects WHERE id = ${input.projectId}`.pipe(
          Effect.orDie,
        );
      }),
    });
  }),
);
