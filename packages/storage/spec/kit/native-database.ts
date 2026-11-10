import { NodeServices } from '@effect/platform-node';
import { SqliteClient, SqliteMigrator } from '@effect/sql-sqlite-node';
import { Effect, Layer, ManagedRuntime } from 'effect';
import { join } from 'node:path';
import {
  nativeMigrations,
  upgradeLegacyDatabase,
} from '../../src/db/migrate.ts';

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
