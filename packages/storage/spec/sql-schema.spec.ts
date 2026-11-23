import { NodeServices } from '@effect/platform-node';
import { temporaryRoot } from '@porcelain/kernel/test-kit/temporary-root';
import { Layer, ManagedRuntime, Schema, String as EffectString } from 'effect';
import { SqlClient } from 'effect/sql';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import type {} from 'vite-plus/types/import-meta.d.ts';
import { expect, it } from 'vite-plus/test';
import { DATABASE_FILE } from '../src/db/database-files.ts';
import { storageLayer } from '../src/db/storage-layer.ts';
import { repositoryQueries } from './kit/repository-queries.ts';

const root = fileURLToPath(new URL('../../../', import.meta.url));

function checkModels(database: DatabaseSync) {
  const modules = import.meta.glob<Record<string, unknown>>(
    '../src/db/models/**/*.ts',
    { eager: true },
  );
  const columns = database.prepare(
    'SELECT name, "notnull" AS required, dflt_value AS default_value FROM pragma_table_info(?)',
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
        if (
          column.required === 1 &&
          column.default_value === null &&
          !fields.has(String(column.name))
        )
          problems.push(
            `${path}: ${name} omits required column ${model.tableName}.${String(column.name)}`,
          );
      }
    }
  }
  return { modelCount, problems };
}

it('prepares every repository query and checks row models against the migrated SQLite schema', async () => {
  const directory = mkdtempSync(join(temporaryRoot, 'porcelain-sql-schema-'));
  const runtime = ManagedRuntime.make(
    storageLayer(directory, { worktreeIdLength: 32, busyTimeoutMs: 5000 }).pipe(
      Layer.provide(NodeServices.layer),
    ),
  );
  try {
    const sql = await runtime.runPromise(SqlClient.SqlClient);
    using database = new DatabaseSync(join(directory, DATABASE_FILE), {
      readOnly: true,
      enableDoubleQuotedStringLiterals: false,
    });
    const queries = repositoryQueries(root, sql);
    expect(queries.length).toBeGreaterThan(0);
    const { modelCount, problems } = checkModels(database);
    for (const { location, text } of queries) {
      try {
        const statement = database.prepare(text);
        if (statement.sourceSQL.trim() !== text)
          problems.push(`${location}: SQLite must prepare the entire query`);
      } catch (error) {
        problems.push(`${location}: ${String(error)}\n${text}`);
      }
    }
    expect(problems, problems.join('\n\n')).toEqual([]);
    expect(modelCount).toBeGreaterThanOrEqual(14);
  } finally {
    await runtime.dispose();
    rmSync(directory, { recursive: true, force: true });
  }
});
