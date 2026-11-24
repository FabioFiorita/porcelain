import {
  ProjectNotFoundError,
  ProjectReconnectionRefusedError,
} from '@porcelain/projects/errors';
import { IdSource } from '@porcelain/kernel/ports';
import {
  InventoryStore,
  WorktreePresenceStore,
} from '@porcelain/projects/ports';
import { Effect } from 'effect';
import { describe, expect, it } from 'vite-plus/test';
import { SequentialIdSource } from '@porcelain/kernel/fakes';
import {
  type ProjectRepository,
  type RegisteredProject,
} from '@porcelain/projects/models';
import { InMemoryInventoryStore } from '../../spec/fakes/in-memory-inventory-store.ts';
import { InMemoryWorktreePresenceStore } from '../../spec/fakes/in-memory-worktree-presence-store.ts';
import { RegisterProjectService } from './register-project-service.ts';

const repository: ProjectRepository = {
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
  const presence = new InMemoryWorktreePresenceStore();
  const service = Effect.runSync(
    RegisterProjectService.pipe(
      Effect.provide(RegisterProjectService.layer),
      Effect.provideService(InventoryStore, inventory),
      Effect.provideService(WorktreePresenceStore, presence),
      Effect.provideService(IdSource, new SequentialIdSource()),
    ),
  );
  return { inventory, presence, service };
}

describe('RegisterProjectService', () => {
  it('registers a new repository under a new id, named after its origin', async () => {
    const { inventory, service } = setup();
    const { project } = Effect.runSync(
      service.execute({
        repository,
        originUrl: 'git@example.com:team/backend.git',
      }),
    );
    expect(project).toEqual({
      id: '00000000-0000-4000-8000-000000000001',
      name: 'backend',
      namedByOwner: false,
      commonDirectory: '/srv/api/.git',
      repositoryIdentity: 'identity-1',
      available: true,
      position: 1,
    });
    expect((await Effect.runPromise(inventory.read())).projects).toEqual([
      project,
    ]);
  });

  it('names a repository without an origin after its main checkout', () => {
    const { service } = setup();
    expect(
      Effect.runSync(service.execute({ repository, originUrl: undefined }))
        .project.name,
    ).toBe('api');
  });

  it('names a repository without a main checkout after the folder holding its Git directory', () => {
    const { service } = setup();
    expect(
      Effect.runSync(
        service.execute({
          repository: {
            ...repository,
            commonDirectory: '/srv/bare/.git',
            worktrees: [],
          },
          originUrl: undefined,
        }),
      ).project.name,
    ).toBe('bare');
  });

  it('returns the existing project when the repository is registered again', async () => {
    const { inventory, service } = setup([registered({})]);
    const { project } = Effect.runSync(
      service.execute({ repository, originUrl: undefined }),
    );
    expect(project.id).toBe('existing');
    expect(project.commonDirectory).toBe('/srv/api/.git');
    expect(project.available).toBe(true);
    expect((await Effect.runPromise(inventory.read())).projects).toHaveLength(
      1,
    );
  });

  it("keeps the owner's name when the repository is registered again", () => {
    const { service } = setup([
      registered({ name: 'Billing', namedByOwner: true }),
    ]);
    const { project } = Effect.runSync(
      service.execute({
        repository,
        originUrl: 'https://example.com/team/backend.git',
      }),
    );
    expect(project.name).toBe('Billing');
    expect(project.namedByOwner).toBe(true);
  });

  it('renames a project the owner never named from the current origin', () => {
    const { service } = setup([registered({ name: 'old' })]);
    expect(
      Effect.runSync(
        service.execute({
          repository,
          originUrl: 'https://example.com/team/new.git',
        }),
      ).project.name,
    ).toBe('new');
  });

  it('reports a change when it registers a new repository', () => {
    const { service } = setup();
    expect(
      Effect.runSync(service.execute({ repository, originUrl: undefined }))
        .changed,
    ).toBe(true);
  });

  it('reports no change when the same repository is registered again as it is', () => {
    const { service } = setup();
    Effect.runSync(service.execute({ repository, originUrl: undefined }));
    expect(
      Effect.runSync(service.execute({ repository, originUrl: undefined }))
        .changed,
    ).toBe(false);
  });

  it('reports a change when registering again makes an unavailable project available', () => {
    const { service } = setup([
      registered({ available: false, commonDirectory: '/srv/api/.git' }),
    ]);
    expect(
      Effect.runSync(service.execute({ repository, originUrl: undefined }))
        .changed,
    ).toBe(true);
  });

  it('lists a new repository after every project registered before it', async () => {
    const { inventory, service } = setup([
      registered({ id: 'first', repositoryIdentity: 'other-1', position: 1 }),
      registered({ id: 'second', repositoryIdentity: 'other-2', position: 4 }),
    ]);
    const { project } = Effect.runSync(
      service.execute({ repository, originUrl: undefined }),
    );
    expect(project.position).toBe(5);
    expect(
      (await Effect.runPromise(inventory.read())).projects.map(
        (entry) => entry.id,
      ),
    ).toEqual(['first', 'second', project.id]);
  });

  it('keeps its place in the inventory when the repository is registered again', async () => {
    const { inventory, service } = setup([
      registered({ id: 'existing', position: 1 }),
      registered({ id: 'later', repositoryIdentity: 'other', position: 2 }),
    ]);
    Effect.runSync(service.execute({ repository, originUrl: undefined }));
    expect(
      (await Effect.runPromise(inventory.read())).projects.map(
        (entry) => entry.id,
      ),
    ).toEqual(['existing', 'later']);
  });
  it('offers the original project without accepting a replacement identity at the same path', () => {
    const saved = registered({ commonDirectory: repository.commonDirectory });
    const { inventory, service } = setup([saved]);
    const result = Effect.runSync(
      service.execute({
        repository: { ...repository, repositoryIdentity: 'replacement' },
        originUrl: undefined,
      }),
    );
    expect(result).toEqual({ project: saved, changed: false });
    expect(Effect.runSync(inventory.read()).projects).toEqual([saved]);
  });

  it('reconnects an explicitly chosen unavailable project while retaining its id, name and position', () => {
    const saved = registered({ name: 'Original project', position: 7 });
    const { inventory, service } = setup([saved]);
    const input = {
      repository: { ...repository, repositoryIdentity: 'replacement' },
      originUrl: 'https://example.com/team/replacement.git',
      reconnectProjectId: saved.id,
    };
    const result = Effect.runSync(service.execute(input));
    expect(result).toEqual({
      changed: true,
      project: {
        ...saved,
        namedByOwner: true,
        commonDirectory: repository.commonDirectory,
        repositoryIdentity: 'replacement',
        available: true,
      },
    });
    expect(Effect.runSync(inventory.read()).projects).toEqual([result.project]);
    expect(Effect.runSync(service.execute(input))).toEqual({
      project: result.project,
      changed: false,
    });
  });

  it('keeps the recovered name when opening the replacement folder again', () => {
    const saved = registered({ name: 'api' });
    const { service } = setup([saved]);
    const replacement = {
      commonDirectory: '/srv/restored/.git',
      repositoryIdentity: 'replacement',
      worktrees: [{ path: '/srv/restored', main: true, available: true }],
    };
    Effect.runSync(
      service.execute({
        repository: replacement,
        originUrl: undefined,
        reconnectProjectId: saved.id,
      }),
    );
    const reopened = Effect.runSync(
      service.execute({ repository: replacement, originUrl: undefined }),
    );
    expect(reopened.project.name).toBe('api');
    expect(reopened.changed).toBe(false);
  });

  it('refuses to reconnect over another registered repository', async () => {
    const saved = registered({});
    const other = registered({
      id: 'other',
      commonDirectory: repository.commonDirectory,
      repositoryIdentity: 'replacement',
    });
    const { inventory, service } = setup([saved, other]);
    await expect(
      Effect.runPromise(
        service.execute({
          repository: { ...repository, repositoryIdentity: 'replacement' },
          originUrl: undefined,
          reconnectProjectId: saved.id,
        }),
      ),
    ).rejects.toThrow(ProjectReconnectionRefusedError);
    expect(Effect.runSync(inventory.read()).projects).toEqual([saved, other]);
  });

  it('refuses an unknown reconnect target instead of creating a new project', async () => {
    const { inventory, service } = setup();
    await expect(
      Effect.runPromise(
        service.execute({
          repository,
          originUrl: undefined,
          reconnectProjectId: 'missing',
        }),
      ),
    ).rejects.toThrow(ProjectNotFoundError);
    expect(Effect.runSync(inventory.read()).projects).toEqual([]);
  });

  it('refuses to replace the identity of a project still known to be available', async () => {
    const saved = registered({ available: true });
    const { inventory, service } = setup([saved]);
    await expect(
      Effect.runPromise(
        service.execute({
          repository: { ...repository, repositoryIdentity: 'replacement' },
          originUrl: undefined,
          reconnectProjectId: saved.id,
        }),
      ),
    ).rejects.toThrow(ProjectReconnectionRefusedError);
    expect(Effect.runSync(inventory.read()).projects).toEqual([saved]);
  });
  it('refuses a replacement folder claimed by another project even when its identity changed', async () => {
    const saved = registered({});
    const other = registered({
      id: 'other',
      commonDirectory: repository.commonDirectory,
      repositoryIdentity: 'other-old-identity',
    });
    const { inventory, service } = setup([saved, other]);
    await expect(
      Effect.runPromise(
        service.execute({
          repository: { ...repository, repositoryIdentity: 'replacement' },
          originUrl: undefined,
          reconnectProjectId: saved.id,
        }),
      ),
    ).rejects.toThrow(ProjectReconnectionRefusedError);
    expect(Effect.runSync(inventory.read()).projects).toEqual([saved, other]);
  });
});
