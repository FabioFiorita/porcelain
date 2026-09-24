import { describe, expect, it } from 'vitest';
import { ProjectNotFoundError } from '@porcelain/projects/errors';
import type { RegisteredProject } from '@porcelain/projects/models';
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
  return { inventory, service: new RenameProjectService(inventory) };
}

describe('RenameProjectService', () => {
  it('answers the project under its new name', () => {
    const { service } = setup();
    expect(service.execute({ projectId: project.id, name: 'Billing' })).toEqual(
      {
        project: { id: project.id, name: 'Billing' },
        changed: true,
      },
    );
  });

  it('reports no change when the owner gives the name the project already has', () => {
    const { service } = setup();
    service.execute({ projectId: project.id, name: 'Billing' });
    expect(
      service.execute({ projectId: project.id, name: 'Billing' }).changed,
    ).toBe(false);
  });

  it('reports a change when the owner confirms a derived name as their own', () => {
    const { inventory, service } = setup();
    expect(
      service.execute({ projectId: project.id, name: project.name }).changed,
    ).toBe(true);
    expect(inventory.read().projects).toEqual([
      { ...project, namedByOwner: true },
    ]);
  });

  it("stores the name as the owner's own, changing nothing else", () => {
    const { inventory, service } = setup();
    service.execute({ projectId: project.id, name: 'Billing' });
    expect(inventory.read().projects).toEqual([
      { ...project, name: 'Billing', namedByOwner: true },
    ]);
  });

  it('refuses a project that is not registered', () => {
    const { inventory, service } = setup();
    expect(() => service.execute({ projectId: 'unknown', name: 'x' })).toThrow(
      ProjectNotFoundError,
    );
    expect(inventory.read().projects).toEqual([project]);
  });
});
