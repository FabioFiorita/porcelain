import { NodeServices } from '@effect/platform-node';
import { Layer, ManagedRuntime } from 'effect';
import { WalkthroughStore } from '@porcelain/walkthroughs/ports';
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
      writer: { provider: 'claude', model: 'claude-opus-5-5' },
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
      provider: 'claude',
    });
    await runtime.runPromise(
      store.saveSettings('project', { mode: 'automatic', provider: 'codex' }),
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
      provider: 'codex',
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
  } finally {
    await runtime.dispose();
    rmSync(directory, { recursive: true, force: true });
  }
});
