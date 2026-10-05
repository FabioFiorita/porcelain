import { fileURLToPath } from 'node:url';
import { Data, Effect, FileSystem, Schema, Stream, String } from 'effect';
import { ChildProcess } from 'effect/process';
import { SqlClient, SqlSchema } from 'effect/sql';
import { NodeRuntime, NodeServices } from '@effect/platform-node';
import { databaseLayer } from '../src/db/connection.ts';
import { readLegacyMigrations } from '../src/db/migrate.ts';
import { CommentSeenRow } from '../src/db/models/comment-reads.ts';
import { CommentRevisionRow } from '../src/db/models/comment-revision.ts';
import {
  CommentThreadRow,
  CommentMessageRow,
} from '../src/db/models/comment-threads.ts';
import { DeviceRow } from '../src/db/models/devices.ts';
import { EnvironmentNameRow } from '../src/db/models/environment-name.ts';
import { EnvironmentRow } from '../src/db/models/environment.ts';
import { GitActionReceiptRow } from '../src/db/models/git-action-receipts.ts';
import { InventoryProjectRow } from '../src/db/models/inventory-projects.ts';
import { PairingGrantRow } from '../src/db/models/pairing-grants.ts';
import { FilePreferenceRow } from '../src/db/models/project-file-preferences.ts';
import { RemoteAccessRow } from '../src/db/models/remote-access.ts';
import { ProofFileRow } from '../src/db/models/review-proof-files.ts';
import { ReviewedFileRow } from '../src/db/models/reviewed-files.ts';
import { ReviewedLayerRow } from '../src/db/models/reviewed-layers.ts';
import { ReviewRow } from '../src/db/models/reviews.ts';
import { WorktreePresenceRow } from '../src/db/models/worktree-presence.ts';

class MigrationCheckError extends Data.TaggedError('MigrationCheckError')<{
  message: string;
}> {}

const directory = fileURLToPath(new URL('../drizzle/', import.meta.url));
const models = [
  CommentSeenRow,
  CommentRevisionRow,
  CommentThreadRow,
  CommentMessageRow,
  DeviceRow,
  EnvironmentNameRow,
  EnvironmentRow,
  GitActionReceiptRow,
  InventoryProjectRow,
  PairingGrantRow,
  FilePreferenceRow,
  RemoteAccessRow,
  ProofFileRow,
  ReviewedFileRow,
  ReviewedLayerRow,
  ReviewRow,
  WorktreePresenceRow,
];
const git = Effect.fn('StorageCheck.git')(function* (args: readonly string[]) {
  return yield* Effect.gen(function* () {
    const child = yield* ChildProcess.make('git', args, {
      cwd: directory,
      stderr: 'ignore',
    });
    const [stdout, code] = yield* Effect.all(
      [
        child.stdout.pipe(
          Stream.decodeText(),
          Stream.runFold(
            () => '',
            (text, chunk) => text + chunk,
          ),
        ),
        child.exitCode,
      ],
      { concurrency: 'unbounded' },
    );
    return code === 0 ? stdout : undefined;
  }).pipe(Effect.scoped);
});

const check = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const shipped = yield* readLegacyMigrations();
  const mergeBase = (yield* git(['merge-base', 'HEAD', 'origin/main']))?.trim();
  const base =
    mergeBase ??
    (yield* git(['rev-parse', '--verify', '--quiet', 'HEAD~1']))?.trim();
  const problems: string[] = [];
  if (!base)
    problems.push(
      'No shipped base: fetch the history so edited migrations can be detected.',
    );
  const files = (yield* fs.readDirectory(directory)).filter((file) =>
    file.endsWith('.sql'),
  );
  const journaled = new Set(shipped.map((entry) => `${entry.tag}.sql`));
  for (const file of files) {
    if (!journaled.has(file))
      problems.push(
        `Migration outside the journal: ${file} has no journal entry, so it is never applied.`,
      );
    const current = yield* fs.readFileString(`${directory}/${file}`);
    for (const commit of base ? [base, 'HEAD'] : ['HEAD']) {
      const original = yield* git(['show', `${commit}:./${file}`]);
      if (original !== undefined && original !== current) {
        problems.push(
          `Shipped migration edited: ${file} differs from ${commit}; applied migrations never change.`,
        );
        break;
      }
    }
  }
  if (base) {
    const original = yield* git(['show', `${base}:./meta/_journal.json`]);
    if (original !== undefined) {
      const journalSchema = Schema.fromJsonString(
        Schema.Struct({
          entries: Schema.Array(
            Schema.Struct({
              idx: Schema.Int,
              when: Schema.Number,
              tag: Schema.String,
            }),
          ),
        }),
      );
      const { entries } = yield* Schema.decodeEffect(journalSchema)(original);
      if (
        entries.some(
          (entry, index) =>
            entry.idx !== shipped[index]?.id ||
            entry.tag !== shipped[index]?.tag ||
            entry.when !== shipped[index]?.timestamp,
        )
      )
        problems.push(
          'Shipped migration journal edited: the recorded prefix must remain unchanged.',
        );
    }
  }
  const temporary = yield* fs.makeTempDirectoryScoped({
    prefix: 'porcelain-storage-check-',
  });
  const database = databaseLayer(temporary, {
    worktreeIdLength: 32,
    busyTimeoutMs: 5000,
  });
  const structure = Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const columns = SqlSchema.findAll({
      Request: Schema.String,
      Result: Schema.Struct({
        name: Schema.String,
        notnull: Schema.Int,
        pk: Schema.Int,
      }),
      execute: (table) => sql`PRAGMA table_info(${sql(table)})`,
    });
    for (const model of models) {
      const actual = yield* columns(model.tableName);
      const expected = Object.entries(model.fields);
      const names = new Set(expected.map(([key]) => String.camelToSnake(key)));
      for (const [key, field] of expected) {
        const column = actual.find(
          (column) => column.name === String.camelToSnake(key),
        );
        if (!column)
          problems.push(
            `Schema change without a migration: ${model.tableName}.${key} is absent.`,
          );
        else if (
          Schema.is(Schema.toEncoded(field))(null) !==
          (column.notnull === 0 && column.pk === 0)
        )
          problems.push(
            `Schema change without a migration: ${model.tableName}.${key} nullability differs.`,
          );
      }
      for (const column of actual)
        if (!names.has(column.name))
          problems.push(
            `Schema column without a model: ${model.tableName}.${column.name}.`,
          );
    }
    if ((yield* sql`PRAGMA foreign_key_check`).length !== 0)
      problems.push('Migrated database contains orphaned rows.');
  }).pipe(Effect.provide(database));
  yield* structure;
  if (problems.length > 0)
    return yield* Effect.fail(
      new MigrationCheckError({ message: problems.join('\n') }),
    );
  yield* Effect.logInfo(
    `Native SQL models and migrations agree; every journaled migration matches ${base} and HEAD.`,
  );
}).pipe(Effect.scoped, Effect.provide(NodeServices.layer));

NodeRuntime.runMain(check);
