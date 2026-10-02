import { WorktreeChangedError } from '@porcelain/kernel/errors';
import { describe, expect, it } from 'vitest';
import type { ListedWorktree } from '@porcelain/projects/models';
import { InMemoryWorktreeCatalogStore } from '../../spec/fakes/in-memory-worktree-catalog-store.ts';
import { ConfirmWorktreeService } from './confirm-worktree-service.ts';

const worktree: ListedWorktree = {
  id: 'worktree-1',
  projectId: 'project-1',
  path: '/srv/api-feature',
  branch: 'refs/heads/feature',
  main: false,
  available: true,
  metadataIdentity: 'metadata-1',
  administrativeDirectory: '/srv/api/.git/worktrees/feature',
  commonDirectory: '/srv/api/.git',
  repositoryIdentity: 'repository-1',
  repositoryId: 'repository-1',
};

const observation = {
  id: 'project-1',
  commonDirectory: '/srv/api/.git',
  repositoryIdentity: 'repository-1',
  observedAt: '2026-09-24T12:00:00.000Z',
  listed: true,
};

function holding(current: ListedWorktree[]) {
  const catalog = new InMemoryWorktreeCatalogStore();
  catalog.save({ projects: [{ observation, worktrees: current }] });
  return catalog;
}

function service(current: ListedWorktree[]) {
  return new ConfirmWorktreeService(holding(current));
}

describe('ConfirmWorktreeService', () => {
  it('confirms a worktree the catalog still holds as it was checked, leaving the catalog as it was', () => {
    const catalog = holding([worktree]);
    expect(() =>
      new ConfirmWorktreeService(catalog).execute({ worktree }),
    ).not.toThrow();
    expect(catalog.find({ worktreeId: 'worktree-1' })).toEqual({
      worktree,
      observation,
    });
  });

  it('still confirms a worktree whose branch or availability changed in place, leaving the catalog as it was', () => {
    const changed = {
      ...worktree,
      branch: 'refs/heads/other',
      available: false,
    };
    const catalog = holding([changed]);
    expect(() =>
      new ConfirmWorktreeService(catalog).execute({ worktree }),
    ).not.toThrow();
    expect(catalog.find({ worktreeId: 'worktree-1' })).toEqual({
      worktree: { ...worktree, branch: 'refs/heads/other', available: false },
      observation,
    });
  });

  it('refuses a worktree the catalog no longer holds', () => {
    expect(() => service([]).execute({ worktree })).toThrow(
      WorktreeChangedError,
    );
  });

  it('refuses a worktree that moved to another folder', () => {
    expect(() =>
      service([{ ...worktree, path: '/srv/api-moved' }]).execute({ worktree }),
    ).toThrow(WorktreeChangedError);
  });

  it('refuses a worktree whose repository is no longer the one checked', () => {
    expect(() =>
      service([{ ...worktree, repositoryIdentity: 'repository-2' }]).execute({
        worktree,
      }),
    ).toThrow(WorktreeChangedError);
  });
});
