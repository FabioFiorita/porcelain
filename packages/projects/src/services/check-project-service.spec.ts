import { describe, expect, it } from 'vitest';
import { ProjectNotFoundError } from '@porcelain/projects/errors';
import type { RegisteredProject } from '@porcelain/projects/models';
import { InMemoryInventoryStore } from '../../spec/fakes/in-memory-inventory-store.ts';
import { CheckProjectService } from './check-project-service.ts';

const project: RegisteredProject = {
  id: 'project-1',
  name: 'api',
  namedByOwner: false,
  commonDirectory: '/srv/api/.git',
  repositoryIdentity: 'identity-1',
  available: false,
  position: 1,
};

describe('CheckProjectService', () => {
  it('answers a registered project even while it is unavailable', () => {
    const service = new CheckProjectService(
      new InMemoryInventoryStore('environment', [project]),
    );
    expect(service.execute({ projectId: project.id })).toEqual(project);
  });

  it('refuses a project that is not registered', () => {
    const service = new CheckProjectService(
      new InMemoryInventoryStore('environment', [project]),
    );
    expect(() => service.execute({ projectId: 'project-2' })).toThrow(
      ProjectNotFoundError,
    );
  });
});
