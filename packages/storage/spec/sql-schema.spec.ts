import { Schema, String as EffectString } from 'effect';
import { DatabaseSync } from 'node:sqlite';
import type {} from 'vite-plus/types/import-meta.d.ts';
import { expect, it } from 'vite-plus/test';
import { withMigratedDatabase } from './kit/native-database.ts';

function checkModels(
  database: DatabaseSync,
  modules: Record<string, Record<string, unknown>>,
) {
  const columns = database.prepare(
    'SELECT name, type, pk, "notnull" AS required, dflt_value AS default_value FROM pragma_table_info(?)',
  );
  const problems: string[] = [];
  let modelCount = 0;
  for (const [path, exports] of Object.entries(modules)) {
    for (const [name, model] of Object.entries(exports)) {
      if (!Schema.isSchema(model)) continue;
      if (
        !('tableName' in model) ||
        typeof model.tableName !== 'string' ||
        !('fields' in model) ||
        typeof model.fields !== 'object' ||
        model.fields === null
      ) {
        problems.push(`${path}: ${name} needs a tableName and row fields`);
        continue;
      }
      modelCount += 1;
      const tableColumns = columns.all(model.tableName);
      const names = new Set(tableColumns.map((column) => column.name));
      const fields = new Set(
        Object.keys(model.fields).map(EffectString.camelToSnake),
      );
      for (const column of fields) {
        if (!names.has(column))
          problems.push(
            `${path}: ${name} expects missing column ${model.tableName}.${column}`,
          );
      }
      for (const column of tableColumns) {
        const primaryKey =
          Number(column.pk) > 0 &&
          String(column.type).toUpperCase() !== 'INTEGER';
        const required = column.required === 1 && column.default_value === null;
        if ((primaryKey || required) && !fields.has(String(column.name)))
          problems.push(
            `${path}: ${name} omits required column ${model.tableName}.${String(column.name)}`,
          );
      }
    }
  }
  return { modelCount, problems };
}

it('requires the model to represent a text primary key even when SQLite marks it nullable', () => {
  using database = new DatabaseSync(':memory:');
  database.exec(
    'CREATE TABLE items (id TEXT PRIMARY KEY, title TEXT NOT NULL)',
  );
  const ItemRow = Object.assign(Schema.Struct({ title: Schema.String }), {
    tableName: 'items',
  });
  expect(checkModels(database, { 'item.ts': { ItemRow } }).problems).toEqual([
    'item.ts: ItemRow omits required column items.id',
  ]);
});

it('checks row models against the migrated SQLite schema', async () => {
  await withMigratedDatabase((database) => {
    const { modelCount, problems } = checkModels(
      database,
      import.meta.glob<Record<string, unknown>>('../src/db/models/**/*.ts', {
        eager: true,
      }),
    );
    expect(problems, problems.join('\n\n')).toEqual([]);
    expect(modelCount).toBeGreaterThan(0);
  });
});
