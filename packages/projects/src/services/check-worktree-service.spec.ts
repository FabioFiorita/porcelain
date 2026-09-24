import { WorktreeNotFoundError } from '@porcelain/kernel/errors';
import { describe, expect, it } from 'vitest';
import { ScriptedWorktreeAccessReader } from '@porcelain/kernel/fakes';
import { WorktreeUnavailableError } from '@porcelain/projects/errors';
import type {
  ListedWorktree,
  RegisteredProject,
} from '@porcelain/projects/models';
import { InMemoryInventoryStore } from '../../spec/fakes/in-memory-inventory-store.ts';
import { CheckWorktreeService } from './check-worktree-service.ts';

const project: RegisteredProject = {
  id: 'project-1',
  name: 'api',
  namedByOwner: false,
  commonDirectory: '/srv/api/.git',
  repositoryIdentity: 'repository-1',
  available: true,
  position: 1,
};

const worktree: ListedWorktree = {
  id: 'worktree-1',
  projectId: project.id,
  path: '/srv/api',
  branch: 'main',
  main: true,
  available: true,
  metadataIdentity: 'worktree-1',
  administrativeDirectory: '/srv/api/.git',
  commonDirectory: project.commonDirectory,
  repositoryIdentity: project.repositoryIdentity,
  repositoryId: project.repositoryIdentity,
};

function service(
  options: {
    found?: readonly ListedWorktree[];
    unreadable?: readonly string[];
    projects?: RegisteredProject[];
  } = {},
) {
  return new CheckWorktreeService(
    new ScriptedWorktreeAccessReader<ListedWorktree>({
      found: options.found ?? [worktree],
      unreadable: options.unreadable,
    }),
    new InMemoryInventoryStore(options.projects ?? [project]),
  );
}

describe('CheckWorktreeService', () => {
  it('answers a known worktree for reading', async () => {
    await expect(
      service().execute({ worktreeId: worktree.id, purpose: 'reading' }),
    ).resolves.toEqual(worktree);
  });

  it('answers an available worktree of an available project for writing', async () => {
    await expect(
      service().execute({ worktreeId: worktree.id, purpose: 'writing' }),
    ).resolves.toEqual(worktree);
  });

  it('still reads a worktree of a project that is unavailable', async () => {
    await expect(
      service({ projects: [{ ...project, available: false }] }).execute({
        worktreeId: worktree.id,
        purpose: 'reading',
      }),
    ).resolves.toEqual(worktree);
  });

  it('refuses to write to a worktree of a project that is unavailable', async () => {
    await expect(
      service({ projects: [{ ...project, available: false }] }).execute({
        worktreeId: worktree.id,
        purpose: 'writing',
      }),
    ).rejects.toThrow(WorktreeUnavailableError);
  });

  it('refuses to write to a worktree whose folder is unavailable', async () => {
    await expect(
      service({ found: [{ ...worktree, available: false }] }).execute({
        worktreeId: worktree.id,
        purpose: 'writing',
      }),
    ).rejects.toThrow(WorktreeUnavailableError);
  });

  it('refuses to write to a worktree whose project is no longer registered', async () => {
    await expect(
      service({ projects: [] }).execute({
        worktreeId: worktree.id,
        purpose: 'writing',
      }),
    ).rejects.toThrow(WorktreeUnavailableError);
  });

  it('refuses a worktree it has never seen', async () => {
    await expect(
      service().execute({ worktreeId: 'unknown', purpose: 'reading' }),
    ).rejects.toThrow(WorktreeNotFoundError);
  });

  it('refuses a worktree whose repository cannot be listed right now', async () => {
    await expect(
      service({ found: [], unreadable: [worktree.id] }).execute({
        worktreeId: worktree.id,
        purpose: 'reading',
      }),
    ).rejects.toThrow(WorktreeUnavailableError);
  });

  it('answers a worktree inside the project the caller named', async () => {
    await expect(
      service().execute({
        worktreeId: worktree.id,
        projectId: project.id,
        purpose: 'reading',
      }),
    ).resolves.toEqual(worktree);
  });

  it('refuses a worktree that belongs to another project than the one named', async () => {
    await expect(
      service().execute({
        worktreeId: worktree.id,
        projectId: 'project-2',
        purpose: 'writing',
      }),
    ).rejects.toThrow(WorktreeNotFoundError);
  });
});
