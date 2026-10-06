import { testClock } from '@porcelain/kernel/test-kit';
import {
  InventoryStore,
  WorktreePresenceStore,
} from '@porcelain/projects/ports';
import { Effect, Clock } from 'effect';
import { describe, expect, it } from 'vitest';
import { ProjectNotFoundError } from '@porcelain/projects/errors';
import {
  type ListedWorktree,
  type RegisteredProject,
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

async function setup() {
  const inventory = new InMemoryInventoryStore([project]);
  const presence = new InMemoryWorktreePresenceStore();
  const clock = await testClock(FIRST);
  const service = Effect.runSync(
    RecordWorktreePresenceService.pipe(
      Effect.provide(RecordWorktreePresenceService.layer),
      Effect.provideService(InventoryStore, inventory),
      Effect.provideService(WorktreePresenceStore, presence),
      Effect.provideService(Clock.Clock, clock),
    ),
  );
  const record = (
    ids: string[],
    listing: { available?: boolean; complete?: boolean } = {},
  ) =>
    Effect.runSync(
      service.execute({
        worktrees: {
          projectId: project.id,
          available: listing.available ?? true,
          complete: listing.complete ?? true,
          worktrees: ids.map(worktree),
        },
      }),
    );
  const missing = async () =>
    Object.fromEntries(
      (await Effect.runPromise(presence.read({ projectId: project.id }))).map(
        (row) => [row.worktreeId, row.missingSince],
      ),
    );
  return { inventory, clock, record, missing };
}

describe('RecordWorktreePresenceService', () => {
  it('records every listed worktree as present', async () => {
    const { record, missing } = await setup();
    record(['main', 'feature']);
    expect(await missing()).toEqual({ main: undefined, feature: undefined });
  });

  it('marks a worktree missing from a complete listing as absent from now', async () => {
    const { record, missing } = await setup();
    record(['main', 'feature']);
    record(['main']);
    expect(await missing()).toEqual({ main: undefined, feature: FIRST });
  });

  it('keeps the moment a worktree first went missing while it stays away', async () => {
    const { clock, record, missing } = await setup();
    record(['main', 'feature']);
    record(['main']);
    await Effect.runPromise(clock.setTime(Date.parse(LATER)));
    record(['main']);
    expect((await missing()).feature).toBe(FIRST);
  });

  it('clears the absence when the worktree comes back', async () => {
    const { clock, record, missing } = await setup();
    record(['main', 'feature']);
    record(['main']);
    await Effect.runPromise(clock.setTime(Date.parse(LATER)));
    record(['main', 'feature']);
    expect(await missing()).toEqual({ main: undefined, feature: undefined });
  });

  it('keeps the worktrees an incomplete listing did reach without marking absences', async () => {
    const { record, missing } = await setup();
    record(['main', 'feature']);
    record(['main'], { complete: false });
    expect(await missing()).toEqual({ main: undefined, feature: undefined });
  });

  it('records a worktree first seen in an incomplete listing', async () => {
    const { record, missing } = await setup();
    record(['feature'], { complete: false });
    expect(await missing()).toEqual({ feature: undefined });
  });

  it('records nothing while the project is unavailable', async () => {
    const { record, missing } = await setup();
    record(['main', 'feature']);
    record([], { available: false, complete: false });
    expect(await missing()).toEqual({ main: undefined, feature: undefined });
  });

  it('refuses a project that is no longer registered', async () => {
    const { inventory, record } = await setup();
    await Effect.runPromise(inventory.remove({ projectId: project.id }));
    expect(() => record(['main'])).toThrow(ProjectNotFoundError);
  });
});
