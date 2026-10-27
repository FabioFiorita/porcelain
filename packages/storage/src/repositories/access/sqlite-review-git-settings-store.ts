import { Effect, Layer, Option, Schema } from 'effect';
import { SqlClient, SqlSchema } from 'effect/sql';
import { reviewGitSettingsSchema } from '@porcelain/access/models';
import { ReviewGitSettingsStore } from '@porcelain/access/ports';

import { ReviewGitSettingsRow } from '../../db/models/review-git-settings.ts';

const settingsJson = Schema.fromJsonString(reviewGitSettingsSchema);

export const sqliteReviewGitSettingsStoreLayer = Layer.effect(
  ReviewGitSettingsStore,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const read = SqlSchema.findOneOption({
      Request: Schema.Void,
      Result: ReviewGitSettingsRow,
      execute: () => sql`SELECT * FROM review_git_settings WHERE singleton = 1`,
    });

    return ReviewGitSettingsStore.of({
      read: Effect.fn('ReviewGitSettingsStore.read')(function* () {
        const row = yield* read(undefined).pipe(Effect.orDie);
        if (Option.isNone(row)) return { kind: 'unconfigured' as const };
        return {
          kind: 'configured' as const,
          revision: row.value.revision,
          settings: yield* Schema.decodeEffect(settingsJson)(
            row.value.settings,
          ).pipe(Effect.orDie),
        };
      }),
      write: Effect.fn('ReviewGitSettingsStore.write')(function* (
        input: Parameters<ReviewGitSettingsStore['write']>[0],
      ) {
        const settings = yield* Schema.encodeEffect(settingsJson)(
          input.settings,
        ).pipe(Effect.orDie);
        yield* sql`INSERT INTO review_git_settings (singleton, revision, settings) VALUES (1, ${input.revision}, ${settings}) ON CONFLICT (singleton) DO UPDATE SET revision = excluded.revision, settings = excluded.settings`.pipe(
          Effect.orDie,
        );
      }),
    });
  }),
);
