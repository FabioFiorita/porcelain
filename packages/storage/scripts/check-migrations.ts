import { readdirSync, readFileSync } from 'node:fs';
import Database from 'better-sqlite3';
import {
  generateSQLiteDrizzleJson,
  generateSQLiteMigration,
} from 'drizzle-kit/api';
import { migrateDatabase } from '../src/db/migrate.ts';

const schemaDirectory = new URL('../src/db/schema/', import.meta.url);
const metaDirectory = new URL('../drizzle/meta/', import.meta.url);
const emptySnapshot = {
  version: '6',
  dialect: 'sqlite',
  id: '00000000-0000-0000-0000-000000000000',
  prevId: '00000000-0000-0000-0000-000000000000',
  tables: {},
  views: {},
  enums: {},
  _meta: { tables: {}, columns: {} },
};

async function schemaSnapshot(): Promise<unknown> {
  const modules: Record<string, unknown> = {};
  for (const file of readdirSync(schemaDirectory).sort((left, right) =>
    left.localeCompare(right),
  )) {
    const module: unknown = await import(new URL(file, schemaDirectory).href);
    Object.assign(modules, module);
  }
  const snapshot: unknown = await generateSQLiteDrizzleJson(modules);
  return snapshot;
}

function latestSnapshot(): unknown {
  const journal = readFileSync(new URL('_journal.json', metaDirectory), 'utf8');
  const idx = [...journal.matchAll(/"tag": "(\d{4})_/g)].at(-1)?.[1];
  const snapshot: unknown = JSON.parse(
    readFileSync(new URL(`${idx}_snapshot.json`, metaDirectory), 'utf8'),
  );
  return snapshot;
}

function structure(database: Database.Database) {
  const rows = <Row extends object>(query: string) =>
    database.prepare<[], Row>(query).all();
  const tables = rows<{ name: string; sql: string }>(
    "SELECT name, sql FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name <> '__drizzle_migrations' ORDER BY name",
  );
  return Object.fromEntries(
    tables.map(({ name, sql }) => [
      name,
      {
        columns: Object.fromEntries(
          rows<{ name: string; cid?: number }>(
            `PRAGMA table_xinfo(\`${name}\`)`,
          ).map((column) => [column.name, { ...column, cid: undefined }]),
        ),
        foreignKeys: rows<{ id?: number; seq?: number }>(
          `PRAGMA foreign_key_list(\`${name}\`)`,
        ).map((key) => ({ ...key, id: undefined, seq: undefined })),
        indexes: rows<{ name: string; unique: number }>(
          `PRAGMA index_list(\`${name}\`)`,
        )
          .map((index) => ({
            name: index.name.startsWith('sqlite_autoindex_')
              ? 'autoindex'
              : index.name,
            unique: index.unique,
            columns: rows<{ name: string }>(
              `PRAGMA index_info(\`${index.name}\`)`,
            ).map((column) => column.name),
          }))
          .sort((left, right) => left.name.localeCompare(right.name)),
        checks: [...sql.matchAll(/CONSTRAINT\s+"?(\w+)"?\s+CHECK/g)]
          .map((match) => match[1] ?? '')
          .sort((left, right) => left.localeCompare(right)),
      },
    ]),
  );
}

function differences(expected: object, actual: object, path = ''): string[] {
  const keys = new Set([...Object.keys(expected), ...Object.keys(actual)]);
  return [...keys].flatMap((key) => {
    const left: unknown = Reflect.get(expected, key);
    const right: unknown = Reflect.get(actual, key);
    const at = `${path}/${key}`;
    if (
      typeof left === 'object' &&
      left !== null &&
      typeof right === 'object' &&
      right !== null
    )
      return differences(left, right, at);
    return JSON.stringify(left) === JSON.stringify(right)
      ? []
      : [
          `${at}: schema ${JSON.stringify(left)}, migrations ${JSON.stringify(right)}`,
        ];
  });
}

const current = await schemaSnapshot();
const pending = await generateSQLiteMigration(latestSnapshot(), current);

const fromSchema = new Database(':memory:');
for (const statement of await generateSQLiteMigration(emptySnapshot, current))
  fromSchema.exec(statement);
const fromMigrations = new Database(':memory:');
fromMigrations.function('porcelain_worktree_id', { varargs: true }, () => null);
migrateDatabase(fromMigrations);
const drift = differences(structure(fromSchema), structure(fromMigrations));

for (const statement of pending)
  console.error(`Schema change without a migration: ${statement}`);
for (const line of drift) console.error(`Migrated database differs: ${line}`);
if (pending.length > 0 || drift.length > 0) process.exitCode = 1;
else console.log('Schema, snapshots and migrations agree');
