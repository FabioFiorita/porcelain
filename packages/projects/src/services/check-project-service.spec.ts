import { InventoryStore } from '@porcelain/projects/ports';
import { Effect } from 'effect';
import { describe, expect, it } from 'vitest';
import { ProjectNotFoundError } from '@porcelain/projects/errors';
import { type RegisteredProject } from '@porcelain/projects/models';
import { InMemoryInventoryStore } from '../../spec/fakes/in-memory-inventory-store.ts';
import { CheckProjectService } from './check-project-service.ts';

const project: RegisteredProject = {
  id: 'project-1',
  name: 'api',
  namedByOwner: false,
  commonDirectory: '/srv/api/.git',
  repositoryIdentity: 'repository-1',
  available: false,
  position: 1,
};

describe('CheckProjectService', () => {
  it('answers a registered project, available or not', () => {
    expect(
      Effect.runSync(
        Effect.runSync(
          CheckProjectService.pipe(
            Effect.provide(CheckProjectService.layer),
            Effect.provideService(
              InventoryStore,
              new InMemoryInventoryStore([project]),
            ),
          ),
        ).execute({
          projectId: project.id,
        }),
      ),
    ).toEqual(project);
  });

  it('refuses a project that is not registered', () => {
    expect(() =>
      Effect.runSync(
        Effect.runSync(
          CheckProjectService.pipe(
            Effect.provide(CheckProjectService.layer),
            Effect.provideService(
              InventoryStore,
              new InMemoryInventoryStore([project]),
            ),
          ),
        ).execute({
          projectId: 'project-2',
        }),
      ),
    ).toThrow(ProjectNotFoundError);
  });
});
