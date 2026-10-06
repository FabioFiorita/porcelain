import { InventoryStore } from '@porcelain/projects/ports';
import { Effect } from 'effect';
import { describe, expect, it } from 'vitest';
import { ProjectNotFoundError } from '@porcelain/projects/errors';
import { type RegisteredProject } from '@porcelain/projects/models';
import { InMemoryInventoryStore } from '../../spec/fakes/in-memory-inventory-store.ts';
import { RenameProjectService } from './rename-project-service.ts';

const project: RegisteredProject = {
  id: 'project-1',
  name: 'api',
  namedByOwner: false,
  commonDirectory: '/srv/api/.git',
  repositoryIdentity: 'identity-1',
  available: false,
  position: 3,
};

function setup() {
  const inventory = new InMemoryInventoryStore([project]);
  return {
    inventory,
    service: Effect.runSync(
      RenameProjectService.pipe(
        Effect.provide(RenameProjectService.layer),
        Effect.provideService(InventoryStore, inventory),
      ),
    ),
  };
}

describe('RenameProjectService', () => {
  it("answers and stores the new name as the owner's own, changing nothing else", async () => {
    const { inventory, service } = setup();
    expect(
      Effect.runSync(
        service.execute({ projectId: project.id, name: 'Billing' }),
      ),
    ).toEqual({
      project: { id: project.id, name: 'Billing' },
      changed: true,
    });
    expect((await Effect.runPromise(inventory.read())).projects).toEqual([
      { ...project, name: 'Billing', namedByOwner: true },
    ]);
  });

  it('reports no change when the owner gives the name the project already has', () => {
    const { service } = setup();
    Effect.runSync(service.execute({ projectId: project.id, name: 'Billing' }));
    expect(
      Effect.runSync(
        service.execute({ projectId: project.id, name: 'Billing' }),
      ).changed,
    ).toBe(false);
  });

  it('reports a change when the owner confirms a derived name as their own', async () => {
    const { inventory, service } = setup();
    expect(
      Effect.runSync(
        service.execute({ projectId: project.id, name: project.name }),
      ).changed,
    ).toBe(true);
    expect((await Effect.runPromise(inventory.read())).projects).toEqual([
      { ...project, namedByOwner: true },
    ]);
  });

  it('refuses a project that is not registered', async () => {
    const { inventory, service } = setup();
    expect(() =>
      Effect.runSync(service.execute({ projectId: 'unknown', name: 'x' })),
    ).toThrow(ProjectNotFoundError);
    expect((await Effect.runPromise(inventory.read())).projects).toEqual([
      project,
    ]);
  });
});
