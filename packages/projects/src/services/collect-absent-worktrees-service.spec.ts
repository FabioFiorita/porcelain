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
  it('collects a named worktree absent for longer than the grace period and forgets it', () => {
    const { presence, service } = setup('2026-08-31T00:00:00.001Z', [
      row('gone', '2026-08-01T00:00:00.000Z'),
      row('here', undefined),
    ]);
    expect(service.execute({ worktreeIds: ['gone'] })).toEqual({
      collected: ['gone'],
    });
    expect(presence.list()).toEqual([row('here', undefined)]);
  });

  it('keeps a worktree absent for exactly the grace period', () => {
    const { presence, service } = setup('2026-08-31T00:00:00.000Z', [
      row('gone', '2026-08-01T00:00:00.000Z'),
    ]);
    expect(service.execute({ worktreeIds: ['gone'] })).toEqual({
      collected: [],
    });
    expect(presence.list()).toEqual([row('gone', '2026-08-01T00:00:00.000Z')]);
  });

  it('keeps a named worktree that came back after it was listed as expired', () => {
    const { presence, service } = setup('2100-01-01T00:00:00.000Z', [
      row('back', undefined),
    ]);
    expect(service.execute({ worktreeIds: ['back'] })).toEqual({
      collected: [],
    });
    expect(presence.list()).toEqual([row('back', undefined)]);
  });

  it('leaves expired worktrees it was not asked to collect', () => {
    const { presence, service } = setup('2026-12-01T00:00:00.000Z', [
      row('first', '2026-08-01T00:00:00.000Z', 'project-1'),
      row('second', '2026-08-01T00:00:00.000Z', 'project-2'),
    ]);
    expect(service.execute({ worktreeIds: ['first'] })).toEqual({
      collected: ['first'],
    });
    expect(presence.list()).toEqual([
      row('second', '2026-08-01T00:00:00.000Z', 'project-2'),
    ]);
  });

  it('collects nothing for a worktree it does not know', () => {
    const { service } = setup('2026-12-01T00:00:00.000Z', []);
    expect(service.execute({ worktreeIds: ['unknown'] })).toEqual({
      collected: [],
    });
  });
});
