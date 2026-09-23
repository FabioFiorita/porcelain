import { describe, expect, it } from 'vitest';
import type { RegisteredProject } from '@porcelain/projects/models';
import { InMemoryInventoryStore } from '../../spec/fakes/in-memory-inventory-store.ts';
import { UpdateProjectAvailabilityService } from './update-project-availability-service.ts';

const project: RegisteredProject = {
  id: 'project-1',
  name: 'Owner name',
  namedByOwner: true,
  commonDirectory: '/srv/api/.git',
  repositoryIdentity: 'identity-1',
  available: false,
};

function listing(available: boolean) {
  return {
    worktrees: {
      projectId: project.id,
      available,
      complete: available,
      worktrees: [],
    },
  };
}

describe('UpdateProjectAvailabilityService', () => {
  it('stores the availability the listing observed', () => {
    const store = new InMemoryInventoryStore('environment', [project]);
    new UpdateProjectAvailabilityService(store).execute(listing(true));
    expect(store.read().projects).toEqual([{ ...project, available: true }]);
  });

  it('keeps the rest of the stored project, including a rename made while listing', () => {
    const store = new InMemoryInventoryStore('environment', [project]);
    store.save({ ...project, name: 'Renamed meanwhile' });
    new UpdateProjectAvailabilityService(store).execute(listing(true));
    expect(store.read().projects[0]?.name).toBe('Renamed meanwhile');
  });

  it('does not bring back a project removed while it was being listed', () => {
    const store = new InMemoryInventoryStore('environment', [project]);
    store.remove(project.id);
    new UpdateProjectAvailabilityService(store).execute(listing(true));
    expect(store.read().projects).toEqual([]);
  });
});
