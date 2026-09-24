import { describe, expect, it } from 'vitest';
import { FixedClock } from '@porcelain/kernel/fakes';
import { InMemoryWorktreePresenceStore } from '../../spec/fakes/in-memory-worktree-presence-store.ts';
import { CollectAbsentWorktreesService } from './collect-absent-worktrees-service.ts';

function absentSince(at: string) {
  const presence = new InMemoryWorktreePresenceStore();
  presence.observe('project-1', ['gone'], '2026-01-01T00:00:00.000Z');
  presence.observe('project-1', [], at);
  return presence;
}

describe('CollectAbsentWorktreesService', () => {
  it('collects a worktree absent for more than thirty days', () => {
    const presence = absentSince('2026-08-01T00:00:00.000Z');
    const clock = new FixedClock('2026-08-31T00:00:00.001Z');
    expect(
      new CollectAbsentWorktreesService(presence, clock).execute(),
    ).toEqual({ collected: ['gone'] });
    expect(presence.expired('2100-01-01T00:00:00.000Z')).toEqual([]);
  });

  it('keeps a worktree absent for exactly thirty days', () => {
    const presence = absentSince('2026-08-01T00:00:00.000Z');
    const clock = new FixedClock('2026-08-31T00:00:00.000Z');
    expect(
      new CollectAbsentWorktreesService(presence, clock).execute(),
    ).toEqual({ collected: [] });
    expect(presence.expired('2100-01-01T00:00:00.000Z')).toEqual(['gone']);
  });
});
