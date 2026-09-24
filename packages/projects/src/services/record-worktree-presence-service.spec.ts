import { describe, expect, it } from 'vitest';
import { FixedClock } from '@porcelain/kernel/fakes';
import { ProjectNotFoundError } from '@porcelain/projects/errors';
import type {
  ListedWorktree,
  RegisteredProject,
} from '@porcelain/projects/models';
import { InMemoryInventoryStore } from '../../spec/fakes/in-memory-inventory-store.ts';
import { InMemoryWorktreePresenceStore } from '../../spec/fakes/in-memory-worktree-presence-store.ts';
import { RecordWorktreePresenceService } from './record-worktree-presence-service.ts';

const FIRST = '2026-09-01T00:00:00.000Z';
const LATER = '2026-09-02T00:00:00.000Z';

const project: RegisteredProject = {
  id: 'project-1',
  name: 'api',
  namedByOwner: false,
  commonDirectory: '/srv/api/.git',
  repositoryIdentity: 'identity-1',
  available: true,
  position: 1,
};

function worktree(id: string): ListedWorktree {
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
    repositoryId: project.repositoryIdentity,
  };
}

function setup() {
  const inventory = new InMemoryInventoryStore([project]);
  const presence = new InMemoryWorktreePresenceStore();
  const clock = new FixedClock(FIRST);
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
  const missing = () =>
    Object.fromEntries(
      presence
        .read({ projectId: project.id })
        .map((row) => [row.worktreeId, row.missingSince]),
    );
  return { inventory, clock, record, missing };
}

describe('RecordWorktreePresenceService', () => {
  it('records every listed worktree as present', () => {
    const { record, missing } = setup();
    record(['main', 'feature']);
    expect(missing()).toEqual({ main: undefined, feature: undefined });
  });

  it('marks a worktree missing from a complete listing as absent from now', () => {
    const { record, missing } = setup();
    record(['main', 'feature']);
    record(['main']);
    expect(missing()).toEqual({ main: undefined, feature: FIRST });
  });

  it('keeps the moment a worktree first went missing while it stays away', () => {
    const { clock, record, missing } = setup();
    record(['main', 'feature']);
    record(['main']);
    clock.set(LATER);
    record(['main']);
    expect(missing().feature).toBe(FIRST);
  });

  it('clears the absence when the worktree comes back', () => {
    const { clock, record, missing } = setup();
    record(['main', 'feature']);
    record(['main']);
    clock.set(LATER);
    record(['main', 'feature']);
    expect(missing()).toEqual({ main: undefined, feature: undefined });
  });

  it('keeps the worktrees an incomplete listing did reach without marking absences', () => {
    const { record, missing } = setup();
    record(['main', 'feature']);
    record(['main'], { complete: false });
    expect(missing()).toEqual({ main: undefined, feature: undefined });
  });

  it('records a worktree first seen in an incomplete listing', () => {
    const { record, missing } = setup();
    record(['feature'], { complete: false });
    expect(missing()).toEqual({ feature: undefined });
  });

  it('records nothing while the project is unavailable', () => {
    const { record, missing } = setup();
    record(['main', 'feature']);
    record([], { available: false, complete: false });
    expect(missing()).toEqual({ main: undefined, feature: undefined });
  });

  it('refuses a project that is no longer registered', () => {
    const { inventory, record } = setup();
    inventory.remove({ projectId: project.id });
    expect(() => record(['main'])).toThrow(ProjectNotFoundError);
  });
});
