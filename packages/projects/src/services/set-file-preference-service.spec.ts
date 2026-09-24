import { describe, expect, it } from 'vitest';
import {
  FilePreferenceLimitError,
  ProjectNotFoundError,
} from '@porcelain/projects/errors';
import type { RegisteredProject } from '@porcelain/projects/models';
import { InMemoryFilePreferenceStore } from '../../spec/fakes/in-memory-file-preference-store.ts';
import { InMemoryInventoryStore } from '../../spec/fakes/in-memory-inventory-store.ts';
import { SetFilePreferenceService } from './set-file-preference-service.ts';

const project: RegisteredProject = {
  id: 'project-1',
  name: 'api',
  namedByOwner: false,
  commonDirectory: '/srv/api/.git',
  repositoryIdentity: 'identity-1',
  available: true,
  position: 1,
};

const LIMIT = 2000;

function setup() {
  const preferences = new InMemoryFilePreferenceStore();
  const service = new SetFilePreferenceService(
    new InMemoryInventoryStore([project]),
    preferences,
    { maxPreferences: LIMIT },
  );
  return { preferences, service };
}

describe('SetFilePreferenceService', () => {
  it('pins a path and answers the full list', () => {
    const { service } = setup();
    expect(
      service.execute({
        projectId: project.id,
        path: 'README.md',
        flag: 'pinned',
        value: true,
      }),
    ).toEqual({
      preferences: [{ path: 'README.md', pinned: true, hidden: false }],
      changed: true,
    });
  });

  it('keeps the other flag when one flag changes', () => {
    const { service } = setup();
    service.execute({
      projectId: project.id,
      path: 'a.md',
      flag: 'pinned',
      value: true,
    });
    expect(
      service.execute({
        projectId: project.id,
        path: 'a.md',
        flag: 'hidden',
        value: true,
      }),
    ).toEqual({
      preferences: [{ path: 'a.md', pinned: true, hidden: true }],
      changed: true,
    });
  });

  it('forgets a path once neither flag is set', () => {
    const { preferences, service } = setup();
    service.execute({
      projectId: project.id,
      path: 'a.md',
      flag: 'pinned',
      value: true,
    });
    expect(
      service.execute({
        projectId: project.id,
        path: 'a.md',
        flag: 'pinned',
        value: false,
      }),
    ).toEqual({ preferences: [], changed: true });
    expect(preferences.count({ projectId: project.id })).toBe(0);
  });

  it('stores nothing and reports no change when clearing a flag on a path without preferences', () => {
    const { preferences, service } = setup();
    expect(
      service.execute({
        projectId: project.id,
        path: 'a.md',
        flag: 'hidden',
        value: false,
      }).changed,
    ).toBe(false);
    expect(preferences.count({ projectId: project.id })).toBe(0);
  });

  it('reports no change when a flag is set to the value it already has', () => {
    const { service } = setup();
    service.execute({
      projectId: project.id,
      path: 'a.md',
      flag: 'pinned',
      value: true,
    });
    expect(
      service.execute({
        projectId: project.id,
        path: 'a.md',
        flag: 'pinned',
        value: true,
      }),
    ).toEqual({
      preferences: [{ path: 'a.md', pinned: true, hidden: false }],
      changed: false,
    });
  });

  it('refuses an unknown project', () => {
    const { service } = setup();
    expect(() =>
      service.execute({
        projectId: 'unknown',
        path: 'a.md',
        flag: 'pinned',
        value: true,
      }),
    ).toThrow(ProjectNotFoundError);
  });

  it('refuses a new path once the project holds as many preferences as allowed', () => {
    const { preferences, service } = setup();
    for (let index = 0; index < LIMIT; index++)
      preferences.save({
        projectId: project.id,
        preference: { path: `f${index}`, pinned: true, hidden: false },
      });
    expect(() =>
      service.execute({
        projectId: project.id,
        path: 'new.md',
        flag: 'pinned',
        value: true,
      }),
    ).toThrow(FilePreferenceLimitError);
    expect(
      preferences.find({ projectId: project.id, path: 'new.md' }),
    ).toBeUndefined();
  });

  it('accepts the last preference the limit allows', () => {
    const { preferences, service } = setup();
    for (let index = 0; index < LIMIT - 1; index++)
      preferences.save({
        projectId: project.id,
        preference: { path: `f${index}`, pinned: true, hidden: false },
      });
    service.execute({
      projectId: project.id,
      path: 'last.md',
      flag: 'pinned',
      value: true,
    });
    expect(preferences.count({ projectId: project.id })).toBe(LIMIT);
  });

  it('still changes and clears existing paths at the limit', () => {
    const { preferences, service } = setup();
    for (let index = 0; index < LIMIT; index++)
      preferences.save({
        projectId: project.id,
        preference: { path: `f${index}`, pinned: true, hidden: false },
      });
    service.execute({
      projectId: project.id,
      path: 'f0',
      flag: 'hidden',
      value: true,
    });
    expect(preferences.find({ projectId: project.id, path: 'f0' })).toEqual({
      path: 'f0',
      pinned: true,
      hidden: true,
    });
    service.execute({
      projectId: project.id,
      path: 'f1',
      flag: 'pinned',
      value: false,
    });
    expect(preferences.count({ projectId: project.id })).toBe(LIMIT - 1);
  });
});
