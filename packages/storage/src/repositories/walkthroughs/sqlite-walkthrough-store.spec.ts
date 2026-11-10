import { DatabaseSync } from 'node:sqlite';
import { NodeServices } from '@effect/platform-node';
import { Effect, Layer, ManagedRuntime } from 'effect';
import {
  WalkthroughStore,
  WalkthroughWriter,
} from '@porcelain/walkthroughs/ports';
import {
  AnswerWalkthroughMessageService,
  ResolveWalkthroughWriterService,
} from '@porcelain/walkthroughs/services';
import { InventoryStore } from '@porcelain/projects/ports';
import type { WalkthroughJob } from '@porcelain/walkthroughs/models';
import { storageLayer } from '../../index.ts';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';

function job(
  id: string,
  headOid: string,
  pullRequestNumber = 42,
): WalkthroughJob {
  return {
    worktreePath: '/fixture',
    files: [],
    run: {
      id,
      projectId: 'project',
      worktreeId: 'worktree',
      headOid,
      baseOid: 'base',
      pullRequestNumber,
      writer: { provider: 'claude', model: 'claude-opus-5-5', effort: 'high' },
      sessionId: undefined,
      createdAt: '2026-11-09T00:00:00.000Z',
      state: { status: 'queued' },
    },
  };
}
it('defaults to manual and persists preferences and one automatic attempt per PR across failure, changed heads and restart', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'automatic-walkthrough-'));
  const open = () =>
    ManagedRuntime.make(
      storageLayer(directory, {
        worktreeIdLength: 32,
        busyTimeoutMs: 5000,
      }).pipe(Layer.provide(NodeServices.layer)),
    );
  let runtime = open();
  try {
    const store = await runtime.runPromise(WalkthroughStore);
    const inventory = await runtime.runPromise(InventoryStore);
    await runtime.runPromise(
      inventory.save({
        id: 'project',
        name: 'Fixture',
        namedByOwner: false,
        commonDirectory: '/fixture/.git',
        repositoryIdentity: 'fixture',
        available: true,
        position: 0,
      }),
    );
    expect(await runtime.runPromise(store.readSettings('project'))).toEqual({
      mode: 'manual',
    });
    await runtime.runPromise(
      store.saveSettings('project', {
        mode: 'automatic',
        writer: { provider: 'codex', model: 'gpt-6.1-sol', effort: 'high' },
      }),
    );
    const key = 'https://github.com/fixture/project/pull/42';
    const first = await runtime.runPromise(
      store.accept(job('first', 'head-one'), key),
    );
    expect(first.id).toBe('first');
    expect(
      (await runtime.runPromise(store.accept(job('repeated', 'head-one'), key)))
        .id,
    ).toBe('first');
    await runtime.runPromise(
      store.save({
        ...first,
        state: {
          status: 'failed',
          failure: { kind: 'other', message: 'Fixture writer failed' },
        },
      }),
    );
    await runtime.runPromise(
      store.cachePullRequests('project', [
        { branch: 'topic', title: 'Readable PR title' },
      ]),
    );
    await runtime.dispose();
    runtime = open();
    const reopened = await runtime.runPromise(WalkthroughStore);
    expect(await runtime.runPromise(reopened.readSettings('project'))).toEqual({
      mode: 'automatic',
      writer: { provider: 'codex', model: 'gpt-6.1-sol', effort: 'high' },
    });
    const repeated = await runtime.runPromise(
      reopened.accept(job('after-restart', 'head-two'), key),
    );
    expect(repeated.id).toBe('first');
    expect(repeated.state.status).toBe('failed');
    expect(await runtime.runPromise(reopened.listPending())).toEqual([]);
    expect(await runtime.runPromise(reopened.readTitles('project'))).toEqual([
      { branch: 'topic', title: 'Readable PR title' },
    ]);
    expect(
      (
        await runtime.runPromise(
          reopened.accept(
            job('new-pr', 'head-two', 43),
            'https://github.com/fixture/project/pull/43',
          ),
        )
      ).id,
    ).toBe('new-pr');
    const another = job('another-pr', 'head-two');
    const differentPr = {
      ...another,
      run: { ...another.run, pullRequestNumber: 44 },
    };
    expect(
      (
        await runtime.runPromise(
          reopened.accept(
            differentPr,
            'https://github.com/fixture/project/pull/44',
          ),
        )
      ).id,
    ).toBe('another-pr');
    const changedWriter: WalkthroughJob = {
      ...differentPr,
      run: {
        ...differentPr.run,
        id: 'changed-writer',
        writer: { provider: 'claude', model: 'sonnet', effort: 'medium' },
      },
    };
    expect((await runtime.runPromise(reopened.accept(changedWriter))).id).toBe(
      'changed-writer',
    );
  } finally {
    await runtime.dispose();
    rmSync(directory, { recursive: true, force: true });
  }
});

it('resolves every comment answer from request, project, changed default and built-in without resuming another model', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'walkthrough-answer-writer-'));
  const seen: WalkthroughJob['run'][] = [];
  const database = storageLayer(directory, {
    worktreeIdLength: 32,
    busyTimeoutMs: 5000,
  }).pipe(Layer.provide(NodeServices.layer));
  const runtime = ManagedRuntime.make(
    AnswerWalkthroughMessageService.layer.pipe(
      Layer.provideMerge(ResolveWalkthroughWriterService.layer),
      Layer.provideMerge(database),
      Layer.provide(
        Layer.succeed(WalkthroughWriter, {
          write: () => Effect.die('Not used'),
          answer: (input) => {
            seen.push(input.run);
            return Effect.succeed({
              text: 'Answer',
              sessionId: 'answer-session',
              durationMs: 1,
              costUsd: undefined,
            });
          },
        }),
      ),
    ),
  );
  try {
    const store = await runtime.runPromise(WalkthroughStore);
    const inventory = await runtime.runPromise(InventoryStore);
    await runtime.runPromise(
      inventory.save({
        id: 'project',
        name: 'Fixture',
        namedByOwner: false,
        commonDirectory: '/fixture/.git',
        repositoryIdentity: 'fixture',
        available: true,
        position: 0,
      }),
    );
    const original = job('ready', 'head').run;
    await runtime.runPromise(
      store.accept({
        ...job('ready', 'head'),
        run: {
          ...original,
          writer: { provider: 'claude', model: 'haiku', effort: 'low' },
          sessionId: 'old-model-session',
          state: {
            status: 'ready',
            writtenAt: '2026-11-09T00:00:00.000Z',
            durationMs: 1,
            content: {
              outcome: 'worth_knowing',
              title: 'Fixture',
              summary: 'Fixture',
              growth: [],
              stops: [],
              onlyInTranscript: [],
              stillUnclear: [],
            },
          },
        },
      }),
    );
    const answer = async (
      id: string,
      writer?: WalkthroughJob['run']['writer'],
    ) => {
      await runtime.runPromise(
        store.addMessage({
          id,
          runId: 'ready',
          worktreeId: 'worktree',
          stopTitle: undefined,
          text: 'Why?',
          createdAt: '2026-11-09T00:00:00.000Z',
          post: { status: 'none' },
          answer: { status: 'answering' },
          writer,
        }),
      );
      await runtime.runPromise(
        AnswerWalkthroughMessageService.use((service) => service.execute()),
      );
      return seen.at(-1);
    };
    expect((await answer('built-in'))?.writer).toEqual({
      provider: 'claude',
      model: 'claude-opus-5-5',
      effort: 'high',
    });
    expect(seen.at(-1)?.sessionId).toBeUndefined();
    await runtime.runPromise(
      store.saveDefaultWriter({
        provider: 'claude',
        model: 'sonnet',
        effort: 'medium',
      }),
    );
    expect((await answer('default'))?.writer).toEqual({
      provider: 'claude',
      model: 'sonnet',
      effort: 'medium',
    });
    await runtime.runPromise(
      store.saveDefaultWriter({
        provider: 'codex',
        model: 'gpt-5.5',
        effort: 'high',
      }),
    );
    expect((await answer('changed-default'))?.writer).toEqual({
      provider: 'codex',
      model: 'gpt-5.5',
      effort: 'high',
    });
    await runtime.runPromise(
      store.saveSettings('project', {
        mode: 'manual',
        writer: { provider: 'claude', model: 'haiku', effort: 'low' },
      }),
    );
    expect((await answer('override'))?.writer).toEqual({
      provider: 'claude',
      model: 'haiku',
      effort: 'low',
    });
    expect(seen.at(-1)?.sessionId).toBe('old-model-session');
    expect(
      (
        await answer('request', {
          provider: 'claude',
          model: 'claude-opus-5-5',
          effort: 'xhigh',
        })
      )?.writer,
    ).toEqual({
      provider: 'claude',
      model: 'claude-opus-5-5',
      effort: 'xhigh',
    });
    await runtime.runPromise(store.saveSettings('project', { mode: 'manual' }));
    expect((await answer('follow-default'))?.writer).toEqual({
      provider: 'codex',
      model: 'gpt-5.5',
      effort: 'high',
    });
  } finally {
    await runtime.dispose();
    rmSync(directory, { recursive: true, force: true });
  }
});

it('upgrades migration 012 runs to the saved high effort and preserves existing conversation messages in migration 013', async () => {
  const directory = mkdtempSync(
    join(tmpdir(), 'walkthrough-writer-migration-'),
  );
  const open = () =>
    ManagedRuntime.make(
      storageLayer(directory, {
        worktreeIdLength: 32,
        busyTimeoutMs: 5000,
      }).pipe(Layer.provide(NodeServices.layer)),
    );
  let runtime = open();
  try {
    const store = await runtime.runPromise(WalkthroughStore);
    await runtime.runPromise(store.accept(job('legacy', 'head')));
    await runtime.runPromise(
      store.addMessage({
        id: 'legacy-comment',
        runId: 'legacy',
        worktreeId: 'worktree',
        stopTitle: undefined,
        text: 'Keep this question',
        createdAt: '2026-11-09T00:00:00.000Z',
        post: { status: 'saved' },
        answer: { status: 'answering' },
      }),
    );
    await runtime.runPromise(
      store.saveForLater('worktree', 'legacy-comment', true),
    );
    await runtime.dispose();
    const before = new DatabaseSync(join(directory, 'inventory.sqlite'));
    try {
      before.exec(
        "DROP TABLE walkthrough_default_writer; DROP TABLE walkthrough_automatic; DROP TABLE walkthrough_pull_titles; DROP TABLE walkthrough_settings; ALTER TABLE walkthrough_messages DROP COLUMN writer; DROP INDEX IF EXISTS walkthrough_runs_current_head; CREATE UNIQUE INDEX walkthrough_runs_current_head ON walkthrough_runs(worktree_id,head_oid) WHERE status != 'failed'; UPDATE walkthrough_runs SET payload=json_remove(payload,'$.run.writer.effort'); DELETE FROM porcelain_migrations WHERE migration_id >= 13;",
      );
    } finally {
      before.close();
    }
    runtime = open();
    const reopened = await runtime.runPromise(WalkthroughStore);
    expect(
      (await runtime.runPromise(reopened.readJob('legacy')))?.run.writer,
    ).toEqual({ provider: 'claude', model: 'claude-opus-5-5', effort: 'high' });
    expect(
      await runtime.runPromise(
        reopened.readMessage('worktree', 'legacy-comment'),
      ),
    ).toEqual({
      id: 'legacy-comment',
      runId: 'legacy',
      worktreeId: 'worktree',
      stopTitle: undefined,
      text: 'Keep this question',
      createdAt: '2026-11-09T00:00:00.000Z',
      post: { status: 'saved' },
      answer: { status: 'answering' },
      writer: undefined,
    });
    const after = new DatabaseSync(join(directory, 'inventory.sqlite'));
    try {
      expect(
        after
          .prepare(
            'SELECT migration_id,name FROM porcelain_migrations WHERE migration_id >= 12 ORDER BY migration_id',
          )
          .all(),
      ).toEqual([
        { migration_id: 12, name: 'walkthrough_messages' },
        { migration_id: 13, name: 'automatic_walkthroughs' },
        { migration_id: 14, name: 'retire_review_push_kinds' },
      ]);
    } finally {
      after.close();
    }
  } finally {
    await runtime.dispose();
    rmSync(directory, { recursive: true, force: true });
  }
});

it.each(['queued', 'running', 'ready'] as const)(
  'only reuses the current %s attempt and makes a returning writer current after another writer fails',
  async (status) => {
    const directory = mkdtempSync(join(tmpdir(), 'current-walkthrough-'));
    const runtime = ManagedRuntime.make(
      storageLayer(directory, {
        worktreeIdLength: 32,
        busyTimeoutMs: 5000,
      }).pipe(Layer.provide(NodeServices.layer)),
    );
    try {
      const store = await runtime.runPromise(WalkthroughStore);
      const first = await runtime.runPromise(
        store.accept(job('first-ready', 'same-head')),
      );
      const ready = {
        status: 'ready',
        writtenAt: '2026-11-09T00:00:00.000Z',
        durationMs: 1,
        content: {
          outcome: 'worth_knowing',
          title: 'First writer',
          summary: 'Summary',
          growth: [],
          stops: [],
          onlyInTranscript: [],
          stillUnclear: [],
        },
      } as const;
      await runtime.runPromise(store.save({ ...first, state: ready }));
      const baseOther = job('other-failed', 'same-head');
      const other: WalkthroughJob = {
        ...baseOther,
        run: {
          ...baseOther.run,
          writer: { provider: 'codex', model: 'gpt-5.5', effort: 'medium' },
        },
      };
      await runtime.runPromise(store.accept(other));
      await runtime.runPromise(
        store.save({
          ...other.run,
          state: {
            status: 'failed',
            failure: { kind: 'other', message: 'Writer failed' },
          },
        }),
      );
      const returning = await runtime.runPromise(
        store.accept(job('returning', 'same-head')),
      );
      expect(returning.id).toBe('returning');
      expect((await runtime.runPromise(store.read('worktree')))?.id).toBe(
        'returning',
      );
      const state = status === 'ready' ? ready : { status };
      await runtime.runPromise(store.save({ ...returning, state }));
      expect(
        (await runtime.runPromise(store.accept(job('duplicate', 'same-head'))))
          .id,
      ).toBe('returning');
      const again = { ...other, run: { ...other.run, id: 'other-again' } };
      expect((await runtime.runPromise(store.accept(again))).id).toBe(
        'other-again',
      );
      expect(
        (
          await runtime.runPromise(
            store.accept(job('first-again', 'same-head')),
          )
        ).id,
      ).toBe('first-again');
      expect((await runtime.runPromise(store.read('worktree')))?.id).toBe(
        'first-again',
      );
    } finally {
      await runtime.dispose();
      rmSync(directory, { recursive: true, force: true });
    }
  },
);
