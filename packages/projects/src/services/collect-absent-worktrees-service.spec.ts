import { testClock } from '@porcelain/kernel/test-kit';
import {
  WorktreePresenceStore,
  CollectAbsentWorktreesOptions,
} from '@porcelain/projects/ports';
import { Effect, Clock } from 'effect';
import { describe, expect, it } from 'vitest';
import { type WorktreePresence } from '@porcelain/projects/models';
import { InMemoryWorktreePresenceStore } from '../../spec/fakes/in-memory-worktree-presence-store.ts';
import { CollectAbsentWorktreesService } from './collect-absent-worktrees-service.ts';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function row(
  worktreeId: string,
  missingSince: string | undefined,
  projectId = 'project-1',
): WorktreePresence {
  return { worktreeId, projectId, missingSince };
}

async function setup(now: string, rows: WorktreePresence[]) {
  const presence = new InMemoryWorktreePresenceStore();
  await Effect.runPromise(presence.save({ rows }));
  const service = Effect.runSync(
    CollectAbsentWorktreesService.pipe(
      Effect.provide(CollectAbsentWorktreesService.layer),
      Effect.provideService(WorktreePresenceStore, presence),
      Effect.provideService(Clock.Clock, await testClock(now)),
      Effect.provideService(CollectAbsentWorktreesOptions, {
        graceMs: THIRTY_DAYS_MS,
      }),
    ),
  );
  return { presence, service };
}

describe('CollectAbsentWorktreesService', () => {
  it('collects a named worktree absent for longer than the grace period and forgets it', async () => {
    const { presence, service } = await setup('2026-08-31T00:00:00.001Z', [
      row('gone', '2026-08-01T00:00:00.000Z'),
      row('here', undefined),
    ]);
    expect(Effect.runSync(service.execute({ worktreeIds: ['gone'] }))).toEqual({
      collected: ['gone'],
    });
    expect(await Effect.runPromise(presence.list())).toEqual([
      row('here', undefined),
    ]);
  });

  it('keeps a worktree absent for exactly the grace period', async () => {
    const { presence, service } = await setup('2026-08-31T00:00:00.000Z', [
      row('gone', '2026-08-01T00:00:00.000Z'),
    ]);
    expect(Effect.runSync(service.execute({ worktreeIds: ['gone'] }))).toEqual({
      collected: [],
    });
    expect(await Effect.runPromise(presence.list())).toEqual([
      row('gone', '2026-08-01T00:00:00.000Z'),
    ]);
  });

  it('keeps a named worktree that came back after it was listed as expired', async () => {
    const { presence, service } = await setup('2100-01-01T00:00:00.000Z', [
      row('back', undefined),
    ]);
    expect(Effect.runSync(service.execute({ worktreeIds: ['back'] }))).toEqual({
      collected: [],
    });
    expect(await Effect.runPromise(presence.list())).toEqual([
      row('back', undefined),
    ]);
  });

  it('leaves expired worktrees it was not asked to collect', async () => {
    const { presence, service } = await setup('2026-12-01T00:00:00.000Z', [
      row('first', '2026-08-01T00:00:00.000Z', 'project-1'),
      row('second', '2026-08-01T00:00:00.000Z', 'project-2'),
    ]);
    expect(Effect.runSync(service.execute({ worktreeIds: ['first'] }))).toEqual(
      {
        collected: ['first'],
      },
    );
    expect(await Effect.runPromise(presence.list())).toEqual([
      row('second', '2026-08-01T00:00:00.000Z', 'project-2'),
    ]);
  });

  it('collects nothing for a worktree it does not know', async () => {
    const { service } = await setup('2026-12-01T00:00:00.000Z', []);
    expect(
      Effect.runSync(service.execute({ worktreeIds: ['unknown'] })),
    ).toEqual({
      collected: [],
    });
  });
});
