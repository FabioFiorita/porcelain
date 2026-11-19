import { WorktreeCatalogStore } from '@porcelain/projects/ports';
import {
  type ListedWorktree,
  type WorktreeActivity,
} from '@porcelain/projects/models';
import { Effect } from 'effect';
import { describe, expect, it } from 'vitest';
import { InMemoryWorktreeCatalogStore } from '../../spec/fakes/in-memory-worktree-catalog-store.ts';
import { RecordWorktreeActivityService } from './record-worktree-activity-service.ts';

const project = {
  id: 'project-1',
  commonDirectory: '/srv/api/.git',
  repositoryIdentity: 'identity-1',
};

const feature: ListedWorktree = {
  id: 'feature',
  projectId: project.id,
  path: '/srv/feature',
  branch: 'refs/heads/feature',
  main: false,
  available: true,
  metadataIdentity: 'metadata-feature',
  administrativeDirectory: '/srv/api/.git/worktrees/feature',
  commonDirectory: project.commonDirectory,
  repositoryIdentity: project.repositoryIdentity,
  repositoryId: project.repositoryIdentity,
  headCommittedAt: '2026-10-01T09:00:00.000Z',
};

const known = '2026-11-18T23:07:12.914Z';

function subject() {
  const catalog = new InMemoryWorktreeCatalogStore();
  catalog.save({
    projects: [
      {
        observation: {
          ...project,
          observedAt: '2026-11-18T23:00:00.000Z',
          available: true,
        },
        worktrees: [{ ...feature, uncommittedChangedAt: known }],
      },
    ],
  });
  const service = Effect.runSync(
    RecordWorktreeActivityService.pipe(
      Effect.provide(RecordWorktreeActivityService.layer),
      Effect.provideService(WorktreeCatalogStore, catalog),
    ),
  );
  return {
    record: (activity: WorktreeActivity, checkout = feature) =>
      Effect.runPromise(
        service.execute({ observations: [{ ...checkout, activity }] }),
      ),
    changedAt: () =>
      catalog.lastSeen({ projectId: project.id })[0]?.uncommittedChangedAt,
  };
}

describe('RecordWorktreeActivityService', () => {
  it('keeps the last known date through a failed read and replaces it once a read succeeds', async () => {
    const catalog = subject();
    await catalog.record({ kind: 'failed' });
    expect(catalog.changedAt()).toBe(known);
    await catalog.record({ kind: 'dated', at: '2026-11-19T08:00:00.000Z' });
    expect(catalog.changedAt()).toBe('2026-11-19T08:00:00.000Z');
  });

  it('clears the date only after a successful clean read', async () => {
    const catalog = subject();
    await catalog.record({ kind: 'failed' });
    expect(catalog.changedAt()).toBe(known);
    await catalog.record({ kind: 'clean' });
    expect(catalog.changedAt()).toBeUndefined();
  });

  it('ignores a reading taken from a checkout that has since moved', async () => {
    const catalog = subject();
    await catalog.record(
      { kind: 'dated', at: '2026-11-19T08:00:00.000Z' },
      { ...feature, path: '/srv/elsewhere' },
    );
    expect(catalog.changedAt()).toBe(known);
  });
});
