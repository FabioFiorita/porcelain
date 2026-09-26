import { describe, expect, it } from 'vitest';
import { SequentialIdSource } from '@porcelain/kernel/fakes';
import type {
  DiscoveredProjectRepository,
  RegisteredProject,
} from '@porcelain/projects/models';
import { InMemoryInventoryStore } from '../../spec/fakes/in-memory-inventory-store.ts';
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
    position: 1,
    ...overrides,
  };
}

function setup(projects: RegisteredProject[] = []) {
  const inventory = new InMemoryInventoryStore(projects);
  const service = new RegisterProjectService(
    inventory,
    new SequentialIdSource(),
  );
  return { inventory, service };
}

describe('RegisterProjectService', () => {
  it('registers a new repository under a new id, named after its origin', () => {
    const { inventory, service } = setup();
    const { project } = service.execute({
      repository,
      originUrl: 'git@example.com:team/backend.git',
    });
    expect(project).toEqual({
      id: '00000000-0000-4000-8000-000000000001',
      name: 'backend',
      namedByOwner: false,
      commonDirectory: '/srv/api/.git',
      repositoryIdentity: 'identity-1',
      available: true,
      position: 1,
    });
    expect(inventory.read().projects).toEqual([project]);
  });

  it('names a repository without an origin after its main checkout', () => {
    const { service } = setup();
    expect(
      service.execute({ repository, originUrl: undefined }).project.name,
    ).toBe('api');
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
      }).project.name,
    ).toBe('bare');
  });

  it('returns the existing project when the repository is registered again', () => {
    const { inventory, service } = setup([registered({})]);
    const { project } = service.execute({ repository, originUrl: undefined });
    expect(project.id).toBe('existing');
    expect(project.commonDirectory).toBe('/srv/api/.git');
    expect(project.available).toBe(true);
    expect(inventory.read().projects).toHaveLength(1);
  });

  it("keeps the owner's name when the repository is registered again", () => {
    const { service } = setup([
      registered({ name: 'Billing', namedByOwner: true }),
    ]);
    const { project } = service.execute({
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
      }).project.name,
    ).toBe('new');
  });

  it('reports a change when it registers a new repository', () => {
    const { service } = setup();
    expect(service.execute({ repository, originUrl: undefined }).changed).toBe(
      true,
    );
  });

  it('reports no change when the same repository is registered again as it is', () => {
    const { service } = setup();
    service.execute({ repository, originUrl: undefined });
    expect(service.execute({ repository, originUrl: undefined }).changed).toBe(
      false,
    );
  });

  it('reports a change when registering again makes an unavailable project available', () => {
    const { service } = setup([registered({ available: false })]);
    expect(service.execute({ repository, originUrl: undefined }).changed).toBe(
      true,
    );
  });

  it('lists a new repository after every project registered before it', () => {
    const { inventory, service } = setup([
      registered({ id: 'first', repositoryIdentity: 'other-1', position: 1 }),
      registered({ id: 'second', repositoryIdentity: 'other-2', position: 4 }),
    ]);
    const { project } = service.execute({ repository, originUrl: undefined });
    expect(project.position).toBe(5);
    expect(inventory.read().projects.map((entry) => entry.id)).toEqual([
      'first',
      'second',
      project.id,
    ]);
  });

  it('keeps its place in the inventory when the repository is registered again', () => {
    const { inventory, service } = setup([
      registered({ id: 'existing', position: 1 }),
      registered({ id: 'later', repositoryIdentity: 'other', position: 2 }),
    ]);
    service.execute({ repository, originUrl: undefined });
    expect(inventory.read().projects.map((entry) => entry.id)).toEqual([
      'existing',
      'later',
    ]);
  });
});
