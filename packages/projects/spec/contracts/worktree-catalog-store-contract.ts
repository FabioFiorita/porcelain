import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ListedWorktree } from '../../src/models/listed-worktree.ts';
import type {
  CatalogObservation,
  CatalogProject,
} from '../../src/models/worktree-catalog.ts';
import type { WorktreeCatalogStore } from '../../src/ports/worktree-catalog-store.ts';

export type WorktreeCatalogStoreSubject = {
  store: WorktreeCatalogStore;
  close: () => void;
};

function observation(id: string, listed = true): CatalogObservation {
  return {
    id,
    commonDirectory: `/repositories/${id}/.git`,
    repositoryIdentity: `identity-${id}`,
    observedAt: '2026-09-24T12:00:00.000Z',
    listed,
  };
}

function worktree(id: string, projectId: string): ListedWorktree {
  return {
    id,
    projectId,
    path: `/repositories/${projectId}/${id}`,
    branch: 'refs/heads/main',
    main: false,
    available: true,
    metadataIdentity: `metadata-${id}`,
    administrativeDirectory: `/repositories/${projectId}/.git/worktrees/${id}`,
    commonDirectory: `/repositories/${projectId}/.git`,
    repositoryIdentity: `identity-${projectId}`,
    repositoryId: `identity-${projectId}`,
  };
}

function project(id: string, worktreeIds: string[]): CatalogProject {
  return {
    observation: observation(id),
    worktrees: worktreeIds.map((worktreeId) => worktree(worktreeId, id)),
  };
}

export function worktreeCatalogStoreContract(
  subject: string,
  openSubject: () => WorktreeCatalogStoreSubject,
): void {
  describe(subject, () => {
    let opened: WorktreeCatalogStoreSubject;
    let store: WorktreeCatalogStore;

    beforeEach(() => {
      opened = openSubject();
      store = opened.store;
    });

    afterEach(() => {
      opened.close();
    });

    it('knows no worktree and no observation before the first save', () => {
      expect(store.find({ worktreeId: 'main' })).toBeUndefined();
      expect(store.lastSeen({ projectId: 'api' })).toEqual([]);
      expect(store.observations()).toEqual([]);
    });

    it('finds a saved worktree together with the observation of its project', () => {
      store.save({ projects: [project('api', ['main', 'feature'])] });
      expect(store.find({ worktreeId: 'feature' })).toEqual({
        worktree: worktree('feature', 'api'),
        observation: observation('api'),
      });
    });

    it("answers a project's worktrees in the order they were saved, and only that project's", () => {
      store.save({
        projects: [
          project('api', ['main', 'feature']),
          project('web', ['site']),
        ],
      });
      expect(store.lastSeen({ projectId: 'api' })).toEqual([
        worktree('main', 'api'),
        worktree('feature', 'api'),
      ]);
    });

    it('answers every observation in the order the projects were saved', () => {
      store.save({
        projects: [
          project('web', []),
          { observation: observation('api', false), worktrees: [] },
        ],
      });
      expect(store.observations()).toEqual([
        observation('web'),
        observation('api', false),
      ]);
    });

    it('replaces the whole catalog on the next save, forgetting a project left out', () => {
      store.save({
        projects: [project('api', ['main']), project('web', ['site'])],
      });
      store.save({ projects: [project('web', ['site', 'preview'])] });
      expect(store.find({ worktreeId: 'main' })).toBeUndefined();
      expect(store.lastSeen({ projectId: 'api' })).toEqual([]);
      expect(store.lastSeen({ projectId: 'web' })).toEqual([
        worktree('site', 'web'),
        worktree('preview', 'web'),
      ]);
      expect(store.observations()).toEqual([observation('web')]);
    });

    it('keeps what it answered unchanged when the caller edits the answer', () => {
      store.save({ projects: [project('api', ['main'])] });
      Object.assign(store.lastSeen({ projectId: 'api' })[0] ?? {}, {
        path: '/elsewhere',
      });
      Object.assign(store.find({ worktreeId: 'main' })?.worktree ?? {}, {
        path: '/elsewhere',
      });
      expect(store.find({ worktreeId: 'main' })?.worktree.path).toBe(
        '/repositories/api/main',
      );
    });
  });
}
