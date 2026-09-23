import { describe, expect, it } from 'vitest';
import type { RegisteredProject, Worktree } from '@porcelain/projects/models';
import { FixedClock } from '../../spec/fakes/fixed-clock.ts';
import { InMemoryInventoryStore } from '../../spec/fakes/in-memory-inventory-store.ts';
import { InMemoryWorktreePresenceStore } from '../../spec/fakes/in-memory-worktree-presence-store.ts';
import { RecordWorktreePresenceService } from './record-worktree-presence-service.ts';

const project: RegisteredProject = {
  id: 'project-1',
  name: 'api',
  namedByOwner: false,
  commonDirectory: '/srv/api/.git',
  repositoryIdentity: 'identity-1',
  available: true,
};

const later = '2026-09-02T00:00:00.000Z';

function worktree(id: string): Worktree {
  return {
    id,
    projectId: project.id,
    path: `/srv/${id}`,
    branch: undefined,
    main: false,
    available: true,
    metadataIdentity: id,
    administrativeDirectory: `/srv/api/.git/worktrees/${id}`,
    commonDirectory: project.commonDirectory,
    repositoryIdentity: project.repositoryIdentity,
  };
}

function setup() {
  const inventory = new InMemoryInventoryStore('environment', [project]);
  const presence = new InMemoryWorktreePresenceStore();
  const clock = new FixedClock('2026-09-01T00:00:00.000Z');
  const service = new RecordWorktreePresenceService(inventory, presence, clock);
  const record = (
    ids: string[],
    listing: { available?: boolean; complete?: boolean } = {},
  ) =>
    service.execute({
      worktrees: {
        projectId: project.id,
        available: listing.available ?? true,
        complete: listing.complete ?? true,
        worktrees: ids.map(worktree),
      },
    });
  return { inventory, presence, clock, record };
}

describe('RecordWorktreePresenceService', () => {
  it('marks a worktree missing from a complete listing as absent from now', () => {
    const { presence, record } = setup();
    record(['main', 'feature']);
    record(['main']);
    expect(presence.expired(later)).toEqual(['feature']);
    expect(presence.expired('2026-09-01T00:00:00.000Z')).toEqual([]);
  });

  it('clears the absence when the worktree comes back', () => {
    const { presence, record } = setup();
    record(['main', 'feature']);
    record(['main']);
    record(['main', 'feature']);
    expect(presence.expired(later)).toEqual([]);
  });

  it('keeps the worktrees an incomplete listing did reach without marking absences', () => {
    const { presence, record } = setup();
    record(['main', 'feature']);
    record(['main'], { complete: false });
    expect(presence.expired(later)).toEqual([]);
  });

  it('records a worktree first seen in an incomplete listing', () => {
    const { presence, record } = setup();
    record(['feature'], { complete: false });
    record(['main']);
    expect(presence.expired(later)).toEqual(['feature']);
  });

  it('records nothing while the project is unavailable', () => {
    const { presence, record } = setup();
    record(['main', 'feature']);
    record([], { available: false, complete: false });
    expect(presence.expired(later)).toEqual([]);
  });

  it('records nothing for a project removed while it was being listed', () => {
    const { inventory, presence, record } = setup();
    record(['main', 'feature']);
    inventory.remove(project.id);
    record(['main']);
    expect(presence.expired(later)).toEqual([]);
  });
});
