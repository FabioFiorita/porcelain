import { Effect, Layer, Option, Schema } from 'effect';
import { SqlClient, SqlSchema } from 'effect/sql';
import { FilePreferenceStore } from '@porcelain/projects/ports';

import { FilePreferenceRow } from '../../db/models/project-file-preferences.ts';

export const sqliteFilePreferenceStoreLayer = Layer.effect(
  FilePreferenceStore,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const list = SqlSchema.findAll({
      Request: Schema.Struct({ projectId: Schema.String }),
      Result: Schema.Struct({
        path: FilePreferenceRow.fields.path,
        pinned: FilePreferenceRow.fields.pinned,
        hidden: FilePreferenceRow.fields.hidden,
      }),
      execute: (input) =>
        sql`SELECT path, pinned, hidden FROM project_file_preferences WHERE project_id = ${input.projectId} ORDER BY path`,
    });
    const find = SqlSchema.findOneOption({
      Request: Schema.Struct({ projectId: Schema.String, path: Schema.String }),
      Result: Schema.Struct({
        path: FilePreferenceRow.fields.path,
        pinned: FilePreferenceRow.fields.pinned,
        hidden: FilePreferenceRow.fields.hidden,
      }),
      execute: (input) =>
        sql`SELECT path, pinned, hidden FROM project_file_preferences WHERE project_id = ${input.projectId} AND path = ${input.path}`,
    });
    const count = SqlSchema.findOne({
      Request: Schema.Struct({ projectId: Schema.String }),
      Result: Schema.Struct({ total: Schema.Int }),
      execute: (input) =>
        sql`SELECT COUNT(*) AS total FROM project_file_preferences WHERE project_id = ${input.projectId}`,
    });

    return FilePreferenceStore.of({
      list: Effect.fn('FilePreferenceStore.list')(function* (
        input: Parameters<FilePreferenceStore['list']>[0],
      ) {
        return yield* list(input).pipe(Effect.orDie);
      }),
      find: Effect.fn('FilePreferenceStore.find')(function* (
        input: Parameters<FilePreferenceStore['find']>[0],
      ) {
        return Option.getOrUndefined(yield* find(input).pipe(Effect.orDie));
      }),
      count: Effect.fn('FilePreferenceStore.count')(function* (
        input: Parameters<FilePreferenceStore['count']>[0],
      ) {
        return (yield* count(input).pipe(Effect.orDie)).total;
      }),
      save: Effect.fn('FilePreferenceStore.save')(function* (
        input: Parameters<FilePreferenceStore['save']>[0],
      ) {
        return yield* Effect.gen(function* () {
          const row = yield* Schema.encodeEffect(FilePreferenceRow.insert)({
            projectId: input.projectId,
            ...input.preference,
          });
          yield* sql`INSERT INTO project_file_preferences ${sql.insert(row)} ON CONFLICT (project_id, path) DO UPDATE SET ${sql.update(row, ['projectId', 'path'])}`;
        }).pipe(sql.withTransaction, Effect.asVoid, Effect.orDie);
      }),
      remove: Effect.fn('FilePreferenceStore.remove')(function* (
        input: Parameters<FilePreferenceStore['remove']>[0],
      ) {
        yield* sql`DELETE FROM project_file_preferences WHERE project_id = ${input.projectId} AND path = ${input.path}`.pipe(
          Effect.orDie,
        );
      }),
    });
  }),
);
