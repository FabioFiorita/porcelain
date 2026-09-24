import { WorktreeNotFoundError } from '@porcelain/kernel/errors';
import { describe, expect, it } from 'vitest';
import { FixedClock } from '@porcelain/kernel/fakes';
import { WorktreeUnavailableError } from '@porcelain/projects/errors';
import type {
  CatalogObservation,
  CatalogProject,
  ListedWorktree,
  RegisteredProject,
} from '@porcelain/projects/models';
import { InMemoryInventoryStore } from '../../spec/fakes/in-memory-inventory-store.ts';
import { InMemoryWorktreeCatalogStore } from '../../spec/fakes/in-memory-worktree-catalog-store.ts';
import { CheckWorktreeService } from './check-worktree-service.ts';

const MINUTE_MS = 60 * 1000;
const now = '2026-09-24T12:00:00.000Z';

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

function observed(
  overrides: Partial<CatalogObservation> = {},
  worktrees: ListedWorktree[] = [worktree],
): CatalogProject {
  return {
    observation: {
      id: project.id,
      commonDirectory: project.commonDirectory,
      repositoryIdentity: project.repositoryIdentity,
      observedAt: '2026-09-24T11:59:30.000Z',
      listed: true,
      ...overrides,
    },
    worktrees,
  };
}

function service(
  options: {
    catalog?: CatalogProject[];
    projects?: RegisteredProject[];
  } = {},
) {
  const catalog = new InMemoryWorktreeCatalogStore();
  catalog.save({ projects: options.catalog ?? [observed()] });
  return new CheckWorktreeService(
    catalog,
    new InMemoryInventoryStore(options.projects ?? [project]),
    new FixedClock(now),
    { staleAfterMs: MINUTE_MS },
  );
}

const found = { kind: 'found', worktree };

describe('CheckWorktreeService', () => {
  it('answers a worktree the last refresh found, for reading', () => {
    expect(
      service().execute({ worktreeId: worktree.id, purpose: 'reading' }),
    ).toEqual(found);
  });

  it('answers an available worktree of an available project for writing', () => {
    expect(
      service().execute({ worktreeId: worktree.id, purpose: 'writing' }),
    ).toEqual(found);
  });

  it('still reads a worktree of a project that is unavailable', () => {
    expect(
      service({ projects: [{ ...project, available: false }] }).execute({
        worktreeId: worktree.id,
        purpose: 'reading',
      }),
    ).toEqual(found);
  });

  it('refuses to write to a worktree of a project that is unavailable', () => {
    expect(() =>
      service({ projects: [{ ...project, available: false }] }).execute({
        worktreeId: worktree.id,
        purpose: 'writing',
      }),
    ).toThrow(WorktreeUnavailableError);
  });

  it('refuses to write to a worktree whose folder is unavailable', () => {
    expect(() =>
      service({
        catalog: [observed({}, [{ ...worktree, available: false }])],
      }).execute({ worktreeId: worktree.id, purpose: 'writing' }),
    ).toThrow(WorktreeUnavailableError);
  });

  it('refuses to write to a worktree whose project is no longer registered', () => {
    expect(() =>
      service({ projects: [] }).execute({
        worktreeId: worktree.id,
        purpose: 'writing',
      }),
    ).toThrow(WorktreeUnavailableError);
  });

  it('refuses a worktree no fresh refresh has seen', () => {
    expect(() =>
      service().execute({ worktreeId: 'unknown', purpose: 'reading' }),
    ).toThrow(WorktreeNotFoundError);
  });

  it('refuses an unknown worktree as unavailable while a repository could not be listed', () => {
    expect(() =>
      service({ catalog: [observed({ listed: false }, [])] }).execute({
        worktreeId: 'unknown',
        purpose: 'reading',
      }),
    ).toThrow(WorktreeUnavailableError);
  });

  it('refuses a known worktree whose repository could not be listed at the last refresh', () => {
    expect(() =>
      service({ catalog: [observed({ listed: false })] }).execute({
        worktreeId: worktree.id,
        purpose: 'reading',
      }),
    ).toThrow(WorktreeUnavailableError);
  });

  it('answers a worktree inside the project the caller named', () => {
    expect(
      service().execute({
        worktreeId: worktree.id,
        projectId: project.id,
        purpose: 'reading',
      }),
    ).toEqual(found);
  });

  it('refuses a worktree that belongs to another project than the one named', () => {
    expect(() =>
      service().execute({
        worktreeId: worktree.id,
        projectId: 'project-2',
        purpose: 'writing',
      }),
    ).toThrow(WorktreeNotFoundError);
  });

  it('answers stale for a worktree observed longer ago than the staleness limit', () => {
    expect(
      service({
        catalog: [observed({ observedAt: '2026-09-24T11:58:59.999Z' })],
      }).execute({ worktreeId: worktree.id, purpose: 'reading' }),
    ).toEqual({ kind: 'stale' });
  });

  it('still answers a worktree observed exactly at the staleness limit', () => {
    expect(
      service({
        catalog: [observed({ observedAt: '2026-09-24T11:59:00.000Z' })],
      }).execute({ worktreeId: worktree.id, purpose: 'reading' }),
    ).toEqual(found);
  });

  it('answers stale for an unknown worktree before any refresh has observed a project', () => {
    expect(
      service({ catalog: [] }).execute({
        worktreeId: worktree.id,
        purpose: 'reading',
      }),
    ).toEqual({ kind: 'stale' });
  });

  it('answers stale for an unknown worktree while some observation is stale', () => {
    expect(
      service({
        catalog: [observed({ observedAt: '2026-09-24T11:00:00.000Z' }, [])],
      }).execute({ worktreeId: 'unknown', purpose: 'reading' }),
    ).toEqual({ kind: 'stale' });
  });
});
