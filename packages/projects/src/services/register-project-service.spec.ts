import { describe, expect, it } from 'vitest';
import type {
  DiscoveredProjectRepository,
  RegisteredProject,
} from '@porcelain/projects/models';
import { InMemoryInventoryStore } from '../../spec/fakes/in-memory-inventory-store.ts';
import { SequentialIdSource } from '../../spec/fakes/sequential-id-source.ts';
import { RegisterProjectService } from './register-project-service.ts';

const repository: DiscoveredProjectRepository = {
  commonDirectory: '/srv/api/.git',
  repositoryIdentity: 'identity-1',
  worktrees: [
    { path: '/srv/api-feature', main: false, available: true },
    { path: '/srv/api', main: true, available: true },
  ],
};

function registered(overrides: Partial<RegisteredProject>): RegisteredProject {
  return {
    id: 'existing',
    name: 'api',
    namedByOwner: false,
    commonDirectory: '/old/api/.git',
    repositoryIdentity: 'identity-1',
    available: false,
    ...overrides,
  };
}

function setup(projects: RegisteredProject[] = []) {
  const inventory = new InMemoryInventoryStore('environment', projects);
  const service = new RegisterProjectService(
    inventory,
    new SequentialIdSource('project'),
  );
  return { inventory, service };
}

describe('RegisterProjectService', () => {
  it('registers a new repository under a new id, named after its origin', () => {
    const { inventory, service } = setup();
    const project = service.execute({
      repository,
      originUrl: 'git@example.com:team/backend.git',
    });
    expect(project).toEqual({
      id: 'project-1',
      name: 'backend',
      namedByOwner: false,
      commonDirectory: '/srv/api/.git',
      repositoryIdentity: 'identity-1',
      available: true,
    });
    expect(inventory.read().projects).toEqual([project]);
  });

  it('names a repository without an origin after its main checkout', () => {
    const { service } = setup();
    expect(service.execute({ repository, originUrl: undefined }).name).toBe(
      'api',
    );
  });

  it('names a repository without a main checkout after the folder holding its Git directory', () => {
    const { service } = setup();
    expect(
      service.execute({
        repository: {
          ...repository,
          commonDirectory: '/srv/bare/.git',
          worktrees: [],
        },
        originUrl: undefined,
      }).name,
    ).toBe('bare');
  });

  it('returns the existing project when the repository is registered again', () => {
    const { inventory, service } = setup([registered({})]);
    const project = service.execute({ repository, originUrl: undefined });
    expect(project.id).toBe('existing');
    expect(project.commonDirectory).toBe('/srv/api/.git');
    expect(project.available).toBe(true);
    expect(inventory.read().projects).toHaveLength(1);
  });

  it("keeps the owner's name when the repository is registered again", () => {
    const { service } = setup([
      registered({ name: 'Billing', namedByOwner: true }),
    ]);
    const project = service.execute({
      repository,
      originUrl: 'https://example.com/team/backend.git',
    });
    expect(project.name).toBe('Billing');
    expect(project.namedByOwner).toBe(true);
  });

  it('renames a project the owner never named from the current origin', () => {
    const { service } = setup([registered({ name: 'old' })]);
    expect(
      service.execute({
        repository,
        originUrl: 'https://example.com/team/new.git',
      }).name,
    ).toBe('new');
  });
});
