import { NodeServices } from '@effect/platform-node';
import { Effect, Layer, ManagedRuntime } from 'effect';
import { SqlClient } from 'effect/sql';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { expect, it } from 'vitest';
import { databaseLayer } from './connection.ts';
import { upgradeLegacyDatabase } from './migrate.ts';

it.each([false, true])(
  'reopen=%s drops legacy reviews, preserves worktree discussions and marks, enforces exclusive owners, and only migrates once',
  async (reopen) => {
    const directory = mkdtempSync(
      join(tmpdir(), 'porcelain-review-migration-'),
    );
    const options = { worktreeIdLength: 32, busyTimeoutMs: 5000 };
    try {
      const filename = join(directory, 'inventory.sqlite');
      await Effect.runPromise(
        upgradeLegacyDatabase(filename, options).pipe(
          Effect.provide(NodeServices.layer),
        ),
      );
      const old = new DatabaseSync(filename);
      old.exec(`INSERT INTO inventory_projects VALUES ('project', 'Project', 0, '/repo/.git', 'identity', 1, 0);
      INSERT INTO worktree_presence VALUES ('worktree', 'project', NULL);
      INSERT INTO reviews (worktree_id, revision, published_at, active, summary_html, summary_token, summary_secret, layers) VALUES ('worktree', 1, 'today', 1, '<p>Legacy</p>', 'token', 'secret', '[]');
      INSERT INTO review_proof_files VALUES ('worktree', 'proof', 'image/png', X'01');
      INSERT INTO reviewed_layers VALUES ('worktree', 'layer', 'fingerprint', 'today');
      INSERT INTO reviewed_files VALUES ('worktree', 'worktree', '', 'README.md', 'blob', 'today', 0);
      INSERT INTO comment_threads (id, worktree_id, anchor, resolved, revision, size_bytes) VALUES ('thread', 'worktree', '{"kind":"change"}', 0, 1, 4);
      INSERT INTO comment_messages (id, thread_id, worktree_id, body, author) VALUES ('message', 'thread', 'worktree', 'Why?', 'reviewer');`);
      old.close();
      if (reopen) {
        const first = ManagedRuntime.make(
          databaseLayer(directory, options).pipe(
            Layer.provide(NodeServices.layer),
          ),
        );
        await first.runPromise(SqlClient.SqlClient);
        await first.dispose();
      }
      {
        const runtime = ManagedRuntime.make(
          databaseLayer(directory, options).pipe(
            Layer.provide(NodeServices.layer),
          ),
        );
        try {
          const sql = await runtime.runPromise(SqlClient.SqlClient);
          const rows = await Effect.runPromise(
            Effect.gen(function* () {
              return {
                reviews: yield* sql`SELECT * FROM reviews`,
                proof: yield* sql`SELECT * FROM review_proof_files`,
                layers: yield* sql`SELECT * FROM reviewed_layers`,
                marks:
                  yield* sql`SELECT worktree_id, review_id, path, fingerprint FROM reviewed_files`,
                threads:
                  yield* sql`SELECT id, worktree_id, review_id, source_worktree_id FROM comment_threads`,
                messages: yield* sql`SELECT body FROM comment_messages`,
                migrations:
                  yield* sql`SELECT migration_id FROM porcelain_migrations ORDER BY migration_id`,
              };
            }),
          );
          expect({ reopen, ...rows }).toEqual({
            reopen,
            reviews: [],
            proof: [],
            layers: [],
            marks: [
              {
                worktreeId: 'worktree',
                reviewId: null,
                path: 'README.md',
                fingerprint: 'blob',
              },
            ],
            threads: [
              {
                id: 'thread',
                worktreeId: 'worktree',
                reviewId: null,
                sourceWorktreeId: 'worktree',
              },
            ],
            messages: [{ body: 'Why?' }],
            migrations: [
              { migrationId: 1 },
              { migrationId: 2 },
              { migrationId: 3 },
            ],
          });
          await expect(
            Effect.runPromise(
              sql`INSERT INTO reviewed_files VALUES (NULL, NULL, 'worktree', '', 'invalid', 'blob', 'today', 0)`,
            ),
          ).rejects.toThrow();
          await expect(
            Effect.runPromise(
              sql`INSERT INTO comment_threads (id, worktree_id, review_id, source_worktree_id, anchor, resolved, revision, size_bytes) VALUES ('invalid', NULL, NULL, 'worktree', '{}', 0, 1, 0)`,
            ),
          ).rejects.toThrow();
        } finally {
          await runtime.dispose();
        }
      }
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  },
);
