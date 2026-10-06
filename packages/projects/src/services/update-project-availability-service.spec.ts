import { InventoryStore } from '@porcelain/projects/ports';
import { Effect } from 'effect';
import { describe, expect, it } from 'vitest';
import { ProjectNotFoundError } from '@porcelain/projects/errors';
import { type RegisteredProject } from '@porcelain/projects/models';
import { InMemoryInventoryStore } from '../../spec/fakes/in-memory-inventory-store.ts';
import { UpdateProjectAvailabilityService } from './update-project-availability-service.ts';

const project: RegisteredProject = {
  id: 'project-1',
  name: 'Owner name',
  namedByOwner: true,
  commonDirectory: '/srv/api/.git',
  repositoryIdentity: 'identity-1',
  available: false,
  position: 1,
};

function listing(available: boolean) {
  return {
    worktrees: {
      projectId: project.id,
      available,
      worktrees: [],
    },
  };
}

describe('UpdateProjectAvailabilityService', () => {
  it('stores the availability the listing observed', async () => {
    const store = new InMemoryInventoryStore([project]);
    Effect.runSync(
      Effect.runSync(
        UpdateProjectAvailabilityService.pipe(
          Effect.provide(UpdateProjectAvailabilityService.layer),
          Effect.provideService(InventoryStore, store),
        ),
      ).execute(listing(true)),
    );
    expect((await Effect.runPromise(store.read())).projects).toEqual([
      { ...project, available: true },
    ]);
  });

  it('keeps the rest of the stored project, including a rename made while listing', async () => {
    const store = new InMemoryInventoryStore([project]);
    await Effect.runPromise(
      store.save({ ...project, name: 'Renamed meanwhile' }),
    );
    Effect.runSync(
      Effect.runSync(
        UpdateProjectAvailabilityService.pipe(
          Effect.provide(UpdateProjectAvailabilityService.layer),
          Effect.provideService(InventoryStore, store),
        ),
      ).execute(listing(true)),
    );
    expect((await Effect.runPromise(store.read())).projects[0]?.name).toBe(
      'Renamed meanwhile',
    );
  });

  it('refuses a project that is no longer registered, without bringing it back', async () => {
    const store = new InMemoryInventoryStore([project]);
    await Effect.runPromise(store.remove({ projectId: project.id }));
    expect(() =>
      Effect.runSync(
        Effect.runSync(
          UpdateProjectAvailabilityService.pipe(
            Effect.provide(UpdateProjectAvailabilityService.layer),
            Effect.provideService(InventoryStore, store),
          ),
        ).execute(listing(true)),
      ),
    ).toThrow(ProjectNotFoundError);
    expect((await Effect.runPromise(store.read())).projects).toEqual([]);
  });

  it('marks a listed project unavailable when the listing could not reach it', async () => {
    const store = new InMemoryInventoryStore([{ ...project, available: true }]);
    Effect.runSync(
      Effect.runSync(
        UpdateProjectAvailabilityService.pipe(
          Effect.provide(UpdateProjectAvailabilityService.layer),
          Effect.provideService(InventoryStore, store),
        ),
      ).execute(listing(false)),
    );
    expect((await Effect.runPromise(store.read())).projects[0]?.available).toBe(
      false,
    );
  });
});
