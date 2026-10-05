import { Effect, Layer, Schema } from 'effect';
import { SqlClient, SqlSchema } from 'effect/sql';
import { WorktreePresenceStore } from '@porcelain/projects/ports';

import { WorktreePresenceRow } from '../../db/models/worktree-presence.ts';

function presence(row: WorktreePresenceRow) {
  return {
    worktreeId: row.worktreeId,
    projectId: row.projectId,
    missingSince: row.missingSince ?? undefined,
  };
}
export const sqliteWorktreePresenceStoreLayer = Layer.effect(
  WorktreePresenceStore,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const all = SqlSchema.findAll({
      Request: Schema.Void,
      Result: WorktreePresenceRow,
      execute: () => sql`SELECT * FROM worktree_presence`,
    });
    const byProject = SqlSchema.findAll({
      Request: Schema.Struct({ projectId: Schema.String }),
      Result: WorktreePresenceRow,
      execute: (input) =>
        sql`SELECT * FROM worktree_presence WHERE project_id = ${input.projectId}`,
    });

    return WorktreePresenceStore.of({
      list: Effect.fn('WorktreePresenceStore.list')(function* () {
        return (yield* all(undefined).pipe(Effect.orDie)).map(presence);
      }),
      read: Effect.fn('WorktreePresenceStore.read')(function* (
        input: Parameters<WorktreePresenceStore['read']>[0],
      ) {
        return (yield* byProject(input).pipe(Effect.orDie)).map(presence);
      }),
      save: Effect.fn('WorktreePresenceStore.save')(function* (
        input: Parameters<WorktreePresenceStore['save']>[0],
      ) {
        return yield* Effect.gen(function* () {
          for (const presence of input.rows) {
            const row = {
              worktreeId: presence.worktreeId,
              projectId: presence.projectId,
              missingSince: presence.missingSince ?? null,
            };
            yield* sql`INSERT INTO worktree_presence ${sql.insert(row)} ON CONFLICT (worktree_id) DO UPDATE SET ${sql.update(row, ['worktreeId'])}`;
          }
        }).pipe(sql.withTransaction, Effect.asVoid, Effect.orDie);
      }),
      remove: Effect.fn('WorktreePresenceStore.remove')(function* (
        input: Parameters<WorktreePresenceStore['remove']>[0],
      ) {
        if (input.worktreeIds.length === 0) return;
        yield* sql`DELETE FROM worktree_presence WHERE ${sql.in('worktreeId', input.worktreeIds)}`.pipe(
          Effect.orDie,
        );
      }),
    });
  }),
);
