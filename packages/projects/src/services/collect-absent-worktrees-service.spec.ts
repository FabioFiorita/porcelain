import { describe, expect, it } from 'vitest';
import { FixedClock } from '@porcelain/kernel/fakes';
import type { WorktreePresence } from '@porcelain/projects/models';
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

function setup(now: string, rows: WorktreePresence[]) {
  const presence = new InMemoryWorktreePresenceStore();
  presence.save({ rows });
  const service = new CollectAbsentWorktreesService(
    presence,
    new FixedClock(now),
    { graceMs: THIRTY_DAYS_MS },
  );
  return { presence, service };
}

describe('CollectAbsentWorktreesService', () => {
  it('collects a worktree absent for longer than the grace period and forgets it', () => {
    const { presence, service } = setup('2026-08-31T00:00:00.001Z', [
      row('gone', '2026-08-01T00:00:00.000Z'),
      row('here', undefined),
    ]);
    expect(service.execute()).toEqual({ collected: ['gone'] });
    expect(presence.list()).toEqual([row('here', undefined)]);
  });

  it('keeps a worktree absent for exactly the grace period', () => {
    const { presence, service } = setup('2026-08-31T00:00:00.000Z', [
      row('gone', '2026-08-01T00:00:00.000Z'),
    ]);
    expect(service.execute()).toEqual({ collected: [] });
    expect(presence.list()).toEqual([row('gone', '2026-08-01T00:00:00.000Z')]);
  });

  it('never collects a worktree that is present, however long it has been known', () => {
    const { service } = setup('2100-01-01T00:00:00.000Z', [
      row('here', undefined),
    ]);
    expect(service.execute()).toEqual({ collected: [] });
  });

  it('collects expired worktrees of every project at once', () => {
    const { presence, service } = setup('2026-12-01T00:00:00.000Z', [
      row('first', '2026-08-01T00:00:00.000Z', 'project-1'),
      row('second', '2026-08-01T00:00:00.000Z', 'project-2'),
    ]);
    expect(service.execute().collected.toSorted()).toEqual(['first', 'second']);
    expect(presence.list()).toEqual([]);
  });

  it('collects nothing when nothing is known', () => {
    const { service } = setup('2026-12-01T00:00:00.000Z', []);
    expect(service.execute()).toEqual({ collected: [] });
  });
});
