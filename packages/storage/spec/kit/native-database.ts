import { NodeServices } from '@effect/platform-node';
import { SqliteClient, SqliteMigrator } from '@effect/sql-sqlite-node';
import { temporaryRoot } from '@porcelain/kernel/test-kit/temporary-root';
import { Effect, Layer, ManagedRuntime } from 'effect';
import { SqlClient } from 'effect/sql';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { DATABASE_FILE } from '../../src/db/database-files.ts';
import {
  nativeMigrations,
  upgradeLegacyDatabase,
} from '../../src/db/migrate.ts';
import { storageLayer } from '../../src/db/storage-layer.ts';

export async function withMigratedDatabase<A>(
  inspect: (database: DatabaseSync, sql: SqlClient.SqlClient) => A,
): Promise<Awaited<A>> {
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
    return await inspect(database, sql);
  } finally {
    await runtime.dispose();
    rmSync(directory, { recursive: true, force: true });
  }
}

export async function prepareNativeDatabase(
  directory: string,
  through: number,
) {
  const filename = join(directory, 'inventory.sqlite');
  await Effect.runPromise(
    upgradeLegacyDatabase(filename, {
      worktreeIdLength: 32,
      busyTimeoutMs: 5000,
    }).pipe(Effect.provide(NodeServices.layer)),
  );
  const runtime = ManagedRuntime.make(
    SqliteClient.layer({ filename }).pipe(Layer.provide(NodeServices.layer)),
  );
  try {
    await runtime.runPromise(
      SqliteMigrator.run({
        table: 'porcelain_migrations',
        loader: nativeMigrations.pipe(
          Effect.map((migrations) =>
            migrations.filter(([id]) => id <= through),
          ),
        ),
      }),
    );
  } finally {
    await runtime.dispose();
  }
  return filename;
}
