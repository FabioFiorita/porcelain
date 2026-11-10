import { NodeServices } from '@effect/platform-node';
import { Effect, Layer, ManagedRuntime, Schema } from 'effect';
import {
  walkthroughJobSchema,
  type WalkthroughJob,
} from '@porcelain/walkthroughs/models';
import { SqlClient } from 'effect/sql';
import { SqliteClient, SqliteMigrator } from '@effect/sql-sqlite-node';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { expect, it } from 'vitest';
import { databaseLayer } from './connection.ts';
import { nativeMigrations, upgradeLegacyDatabase } from './migrate.ts';

it.each([false, true])(
  'reopen=%s deletes saved reviews and discussions while preserving walkthroughs, settings and worktree marks',
  async (reopen) => {
    const directory = mkdtempSync(join(tmpdir(), 'porcelain-retire-reviews-'));
    const filename = join(directory, 'inventory.sqlite');
    const options = { worktreeIdLength: 32, busyTimeoutMs: 5000 };
    try {
      await Effect.runPromise(
        upgradeLegacyDatabase(filename, options).pipe(
          Effect.provide(NodeServices.layer),
        ),
      );
      const legacy = ManagedRuntime.make(
        SqliteClient.layer({ filename }).pipe(
          Layer.provide(NodeServices.layer),
        ),
      );
      try {
        await legacy.runPromise(
          SqliteMigrator.run({
            table: 'porcelain_migrations',
            loader: nativeMigrations.pipe(
              Effect.map((migrations) => migrations.filter(([id]) => id < 16)),
            ),
          }),
        );
      } finally {
        await legacy.dispose();
      }
      const old = new DatabaseSync(filename);
      const job: WalkthroughJob = {
        worktreePath: '/repo',
        patch: 'uncommitted patch',
        files: [],
        run: {
          id: 'run',
          projectId: 'project',
          worktreeId: 'worktree',
          headOid: 'committed-head',
          baseOid: 'base',
          baseRef: 'refs/heads/main',
          contentTreeOid: 'working-tree-content',
          includesUncommitted: true,
          branch: 'refs/heads/feature',
          writer: { provider: 'codex', model: 'gpt-6.1-sol', effort: 'high' },
          createdAt: 'today',
          state: {
            status: 'ready',
            writtenAt: 'today',
            durationMs: 1000,
            content: {
              outcome: 'worth_knowing',
              title: 'Keep ownership',
              summary: 'Read the working change',
              growth: [],
              stops: [],
              onlyInTranscript: [],
              stillUnclear: [],
            },
          },
        },
      };
      const run = JSON.stringify(job);
      old.exec(`PRAGMA foreign_keys = ON;
      INSERT INTO inventory_projects VALUES ('project', 'Project', 0, '/repo/.git', 'identity', 1, 0);
      INSERT INTO worktree_presence VALUES ('worktree', 'project', NULL);
      INSERT INTO reviews (review_id, project_id, common_directory, branch, state, latest_revision) VALUES ('old-review','project','/repo/.git','feature','open',1);
      INSERT INTO reviewed_layers VALUES ('old-review','decision','decision-print','today');
      INSERT INTO reviewed_files VALUES ('worktree',NULL,'worktree','','a.ts','worktree-print','today',0);
      INSERT INTO reviewed_files VALUES ('worktree',NULL,'branch','feature','a.ts','branch-print','yesterday',1);
      INSERT INTO reviewed_files VALUES (NULL,'old-review','worktree','','saved.ts','saved-print','today',0);
      INSERT INTO comment_threads (id,worktree_id,source_worktree_id,anchor,resolved,revision,size_bytes) VALUES ('thread','worktree','worktree','{"kind":"change"}',0,1,4);
      INSERT INTO comment_messages (id,thread_id,worktree_id,body,author) VALUES ('message','thread','worktree','Why?','reviewer');
      INSERT INTO comment_reads VALUES ('worktree',1);
      INSERT INTO review_git_settings VALUES (1,7,'{"groupSpecFiles":true}');
      INSERT INTO walkthrough_runs (id,worktree_id,head_oid,status,payload) VALUES ('run','worktree','committed-head','ready',${"'" + run + "'"});
      INSERT INTO walkthrough_evidence VALUES ('run','proof','image/png','Screen',X'010203');
      INSERT INTO walkthrough_messages (id,run_id,worktree_id,text,created_at,answer_status,answer,writer) VALUES ('question','run','worktree','Why?','today','answered','{"status":"answered","text":"Because","answeredAt":"today","durationMs":1000}','{"provider":"codex","model":"gpt-6.1-sol","effort":"high"}');
      INSERT INTO walkthrough_default_writer VALUES (1,'{"provider":"codex","model":"gpt-6.1-sol","effort":"high"}');
      INSERT INTO walkthrough_settings VALUES ('project','{"mode":"automatic"}');
      INSERT INTO walkthrough_automatic VALUES ('project/42','run');
      INSERT INTO walkthrough_pull_titles VALUES ('project','feature','Keep the owner');`);
      const retained = [
        'walkthrough_runs',
        'walkthrough_evidence',
        'walkthrough_messages',
        'walkthrough_default_writer',
        'walkthrough_settings',
        'walkthrough_automatic',
        'walkthrough_pull_titles',
        'review_git_settings',
      ];
      const before = retained.map((table) => ({
        table,
        rows: old.prepare(`SELECT * FROM ${table}`).all(),
      }));
      old.close();
      const open = () =>
        ManagedRuntime.make(
          databaseLayer(directory, options).pipe(
            Layer.provide(NodeServices.layer),
          ),
        );
      if (reopen) {
        const first = open();
        try {
          await first.runPromise(SqlClient.SqlClient);
        } finally {
          await first.dispose();
        }
      }
      const current = open();
      try {
        await current.runPromise(SqlClient.SqlClient);
      } finally {
        await current.dispose();
      }
      const stored = new DatabaseSync(filename);
      try {
        expect(
          retained.map((table) => ({
            table,
            rows: stored.prepare(`SELECT * FROM ${table}`).all(),
          })),
        ).toEqual(before);
        const saved = stored
          .prepare("SELECT payload FROM walkthrough_runs WHERE id = 'run'")
          .get();
        expect(
          Schema.decodeUnknownSync(Schema.fromJsonString(walkthroughJobSchema))(
            saved?.payload,
          ),
        ).toEqual(job);
        expect(
          stored
            .prepare(
              "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('reviews','review_seen','review_revisions','review_proof_files','reviewed_layers','review_agent_feedback','comment_threads','comment_messages','comment_reads','comment_revision')",
            )
            .all(),
        ).toEqual([]);
        expect(
          stored.prepare('SELECT * FROM reviewed_files ORDER BY scope').all(),
        ).toEqual([
          {
            worktree_id: 'worktree',
            scope: 'branch',
            branch: 'feature',
            path: 'a.ts',
            fingerprint: 'branch-print',
            reviewed_at: 'yesterday',
            stale: 1,
          },
          {
            worktree_id: 'worktree',
            scope: 'worktree',
            branch: '',
            path: 'a.ts',
            fingerprint: 'worktree-print',
            reviewed_at: 'today',
            stale: 0,
          },
        ]);
        expect(stored.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
        expect(
          stored
            .prepare(
              'SELECT count(*) AS count FROM porcelain_migrations WHERE migration_id = 16',
            )
            .get(),
        ).toEqual({ count: 1 });
        stored.exec('PRAGMA foreign_keys = ON');
        expect(() =>
          stored.exec(
            "INSERT INTO reviewed_files VALUES ('missing','worktree','','a.ts','print','today',0)",
          ),
        ).toThrow();
        stored.exec(
          "DELETE FROM worktree_presence WHERE worktree_id = 'worktree'",
        );
        expect(stored.prepare('SELECT * FROM reviewed_files').all()).toEqual(
          [],
        );
        expect(stored.prepare('SELECT id FROM walkthrough_runs').all()).toEqual(
          [{ id: 'run' }],
        );
      } finally {
        stored.close();
      }
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  },
);

it('clears retired push kinds before the remaining registration reader decodes stored JSON', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'porcelain-push-migration-'));
  const options = { worktreeIdLength: 32, busyTimeoutMs: 5000 };
  const open = () =>
    ManagedRuntime.make(
      databaseLayer(directory, options).pipe(Layer.provide(NodeServices.layer)),
    );
  try {
    const filename = join(directory, 'inventory.sqlite');
    await Effect.runPromise(
      upgradeLegacyDatabase(filename, options).pipe(
        Effect.provide(NodeServices.layer),
      ),
    );
    const initial = ManagedRuntime.make(
      SqliteClient.layer({ filename }).pipe(Layer.provide(NodeServices.layer)),
    );
    try {
      await initial.runPromise(
        SqliteMigrator.run({
          table: 'porcelain_migrations',
          loader: nativeMigrations.pipe(
            Effect.map((migrations) => migrations.filter(([id]) => id < 14)),
          ),
        }),
      );
    } finally {
      await initial.dispose();
    }
    const stored = new DatabaseSync(join(directory, 'inventory.sqlite'));
    stored.exec(`INSERT INTO devices (id, label, platform, secret_hash, created_at, last_seen_at, route, route_inferred, trusted, can_manage_sharing, can_edit_ways_in) VALUES ('phone', 'Phone', 'ios', 'fixture-hash', '2026-11-10T10:00:00Z', '2026-11-10T10:00:00Z', 'lan', 0, 0, 0, 0);
      INSERT INTO push_registrations (device_id, token, platform, kinds) VALUES ('phone', 'ExponentPushToken[fixture]', 'ios', '["review-ready","agent-reply"]');`);
    stored.close();
    const migrated = open();
    try {
      const sql = await migrated.runPromise(SqlClient.SqlClient);
      expect(
        await Effect.runPromise(
          sql`SELECT device_id, token, kinds FROM push_registrations`,
        ),
      ).toEqual([
        { deviceId: 'phone', token: 'ExponentPushToken[fixture]', kinds: '[]' },
      ]);
    } finally {
      await migrated.dispose();
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

it('upgrades migration 012 writer defaults while retaining the saved conversation', async () => {
  const directory = mkdtempSync(
    join(tmpdir(), 'porcelain-writer-default-upgrade-'),
  );
  const filename = join(directory, 'inventory.sqlite');
  const options = { worktreeIdLength: 32, busyTimeoutMs: 5000 };
  try {
    await Effect.runPromise(
      upgradeLegacyDatabase(filename, options).pipe(
        Effect.provide(NodeServices.layer),
      ),
    );
    const prefix = ManagedRuntime.make(
      SqliteClient.layer({ filename }).pipe(Layer.provide(NodeServices.layer)),
    );
    try {
      await prefix.runPromise(
        SqliteMigrator.run({
          table: 'porcelain_migrations',
          loader: nativeMigrations.pipe(
            Effect.map((migrations) => migrations.filter(([id]) => id <= 12)),
          ),
        }),
      );
    } finally {
      await prefix.dispose();
    }
    const old = new DatabaseSync(filename);
    old.exec(`INSERT INTO walkthrough_runs (id,worktree_id,head_oid,status,payload) VALUES ('legacy','worktree','head','queued','{"run":{"writer":{"provider":"claude","model":"claude-opus-5-5"}}}');
      INSERT INTO walkthrough_messages (id,run_id,worktree_id,text,created_at,post_status,answer_status,answer) VALUES ('question','legacy','worktree','Keep this question','today','saved','answering','{"status":"answering"}');`);
    old.close();
    const current = ManagedRuntime.make(
      SqliteClient.layer({ filename }).pipe(Layer.provide(NodeServices.layer)),
    );
    try {
      await current.runPromise(
        SqliteMigrator.run({
          table: 'porcelain_migrations',
          loader: nativeMigrations.pipe(
            Effect.map((migrations) => migrations.filter(([id]) => id <= 13)),
          ),
        }),
      );
    } finally {
      await current.dispose();
    }
    const stored = new DatabaseSync(filename);
    try {
      expect(
        stored
          .prepare(
            "SELECT json_extract(payload,'$.run.writer') AS writer FROM walkthrough_runs WHERE id='legacy'",
          )
          .get(),
      ).toEqual({
        writer:
          '{"provider":"claude","model":"claude-opus-5-5","effort":"high"}',
      });
      expect(
        stored
          .prepare(
            'SELECT id,text,post_status,answer_status,answer,writer FROM walkthrough_messages',
          )
          .all(),
      ).toEqual([
        {
          id: 'question',
          text: 'Keep this question',
          post_status: 'saved',
          answer_status: 'answering',
          answer: '{"status":"answering"}',
          writer: null,
        },
      ]);
    } finally {
      stored.close();
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

it.each([12, 14])(
  'prefix=%i drops old commit-bound walkthrough runs and their dependent data at the content identity switch',
  async (prefix) => {
    const directory = mkdtempSync(
      join(tmpdir(), 'walkthrough-tree-migration-'),
    );
    const options = { worktreeIdLength: 32, busyTimeoutMs: 5000 };
    const open = () =>
      ManagedRuntime.make(
        databaseLayer(directory, options).pipe(
          Layer.provide(NodeServices.layer),
        ),
      );
    const filename = join(directory, 'inventory.sqlite');
    let runtime = ManagedRuntime.make(
      SqliteClient.layer({ filename }).pipe(Layer.provide(NodeServices.layer)),
    );
    try {
      await Effect.runPromise(
        upgradeLegacyDatabase(filename, options).pipe(
          Effect.provide(NodeServices.layer),
        ),
      );
      await runtime.runPromise(
        SqliteMigrator.run({
          table: 'porcelain_migrations',
          loader: nativeMigrations.pipe(
            Effect.map((migrations) =>
              migrations.filter(([id]) => id <= prefix),
            ),
          ),
        }),
      );
      await runtime.dispose();
      const old = new DatabaseSync(join(directory, 'inventory.sqlite'));
      old.exec(`INSERT INTO walkthrough_runs (id, worktree_id, head_oid, status, payload) VALUES ('old', 'worktree', 'head', 'ready', '{}');

      INSERT INTO walkthrough_evidence VALUES ('old', 'image', 'image/png', '', X'01');
      INSERT INTO walkthrough_messages (id, run_id, worktree_id, text, created_at, answer) VALUES ('message', 'old', 'worktree', 'Why?', 'today', '{}');`);
      if (prefix === 14)
        old.exec("INSERT INTO walkthrough_automatic VALUES ('pr', 'old')");
      old.close();
      runtime = open();
      const sql = await runtime.runPromise(SqlClient.SqlClient);
      expect(
        await runtime.runPromise(sql`SELECT * FROM walkthrough_runs`),
      ).toEqual([]);
      expect(
        await runtime.runPromise(sql`SELECT * FROM walkthrough_automatic`),
      ).toEqual(prefix === 14 ? [{ prKey: 'pr', runId: null }] : []);
      expect(
        await runtime.runPromise(sql`SELECT * FROM walkthrough_evidence`),
      ).toEqual([]);
      expect(
        await runtime.runPromise(sql`SELECT * FROM walkthrough_messages`),
      ).toEqual([]);
      expect(
        await runtime.runPromise(
          sql`SELECT name FROM porcelain_migrations WHERE migration_id = 15`,
        ),
      ).toEqual([{ name: 'working_tree_walkthroughs' }]);
    } finally {
      await runtime.dispose();
      rmSync(directory, { recursive: true, force: true });
    }
  },
);
