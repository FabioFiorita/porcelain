import { describe, expect, it } from 'vitest';
import type { RegisteredProject } from '@porcelain/projects/models';
import { InMemoryInventoryStore } from '../../spec/fakes/in-memory-inventory-store.ts';
import { RemoveProjectService } from './remove-project-service.ts';

function project(id: string, position: number): RegisteredProject {
  return {
    id,
    name: id,
    namedByOwner: false,
    commonDirectory: `/srv/${id}/.git`,
    repositoryIdentity: `identity-${id}`,
    available: true,
    position,
  };
}

function setup() {
  const inventory = new InMemoryInventoryStore([
    project('api', 1),
    project('web', 2),
  ]);
  return { inventory, service: new RemoveProjectService(inventory) };
}

describe('RemoveProjectService', () => {
  it('removes a registered project and reports that it deleted it', () => {
    const { inventory, service } = setup();
    expect(service.execute({ projectId: 'api' })).toEqual({ deleted: true });
    expect(inventory.read()).toEqual({ projects: [project('web', 2)] });
  });

  it('reports nothing deleted for an unknown project and keeps the others', () => {
    const { inventory, service } = setup();
    expect(service.execute({ projectId: 'unknown' })).toEqual({
      deleted: false,
    });
    expect(inventory.read().projects).toHaveLength(2);
  });

  it('reports nothing deleted when the same project is removed again', () => {
    const { service } = setup();
    service.execute({ projectId: 'api' });
    expect(service.execute({ projectId: 'api' })).toEqual({ deleted: false });
  });
});
