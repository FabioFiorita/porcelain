import { Effect, Layer, Option, Schema } from 'effect';
import { SqlClient, SqlSchema } from 'effect/sql';
import { GitHubAccountStore } from '@porcelain/reviews/ports';
import { GitHubAccountRow } from '../../db/models/github-accounts.ts';
export const sqliteGitHubAccountStoreLayer = Layer.effect(
  GitHubAccountStore,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const read = SqlSchema.findOneOption({
      Request: Schema.Struct({ projectId: Schema.String }),
      Result: GitHubAccountRow,
      execute: ({ projectId }) =>
        sql`SELECT * FROM project_github_accounts WHERE project_id = ${projectId}`,
    });
    return GitHubAccountStore.of({
      read: Effect.fn('GitHubAccountStore.read')(function* (input) {
        const row = Option.getOrUndefined(
          yield* read(input).pipe(Effect.orDie),
        );
        return row === undefined
          ? undefined
          : {
              repository: row.repository,
              detected: row.detected ?? undefined,
              override: row.override ?? undefined,
            };
      }),
      detect: Effect.fn('GitHubAccountStore.detect')(function* (input) {
        yield* sql`INSERT INTO project_github_accounts (project_id, repository, detected) VALUES (${input.projectId}, ${input.repository}, ${input.account ?? null})
        ON CONFLICT(project_id) DO UPDATE SET repository = excluded.repository, detected = excluded.detected`.pipe(
          Effect.orDie,
        );
      }),
      override: Effect.fn('GitHubAccountStore.override')(function* (input) {
        yield* sql`INSERT INTO project_github_accounts (project_id, repository, override) VALUES (${input.projectId}, ${input.repository}, ${input.account ?? null})
        ON CONFLICT(project_id) DO UPDATE SET detected = NULL, repository = excluded.repository, override = excluded.override`.pipe(
          Effect.orDie,
        );
      }),
    });
  }),
);
