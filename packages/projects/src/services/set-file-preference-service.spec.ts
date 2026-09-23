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
};

function setup() {
  const preferences = new InMemoryFilePreferenceStore();
  const service = new SetFilePreferenceService(
    new InMemoryInventoryStore('environment', [project]),
    preferences,
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
    ).toEqual({ preferences: [{ path: 'a.md', pinned: true, hidden: true }] });
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
    ).toEqual({ preferences: [] });
    expect(preferences.count(project.id)).toBe(0);
  });

  it('stores nothing when clearing a flag on a path without preferences', () => {
    const { preferences, service } = setup();
    service.execute({
      projectId: project.id,
      path: 'a.md',
      flag: 'hidden',
      value: false,
    });
    expect(preferences.count(project.id)).toBe(0);
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

  it('refuses a new path once the project holds two thousand preferences', () => {
    const { preferences, service } = setup();
    for (let index = 0; index < 2000; index++)
      preferences.save(project.id, {
        path: `f${index}`,
        pinned: true,
        hidden: false,
      });
    expect(() =>
      service.execute({
        projectId: project.id,
        path: 'new.md',
        flag: 'pinned',
        value: true,
      }),
    ).toThrow(FilePreferenceLimitError);
    expect(preferences.find(project.id, 'new.md')).toBeUndefined();
  });

  it('accepts the two thousandth preference', () => {
    const { preferences, service } = setup();
    for (let index = 0; index < 1999; index++)
      preferences.save(project.id, {
        path: `f${index}`,
        pinned: true,
        hidden: false,
      });
    service.execute({
      projectId: project.id,
      path: 'last.md',
      flag: 'pinned',
      value: true,
    });
    expect(preferences.count(project.id)).toBe(2000);
  });

  it('still changes and clears existing paths at the limit', () => {
    const { preferences, service } = setup();
    for (let index = 0; index < 2000; index++)
      preferences.save(project.id, {
        path: `f${index}`,
        pinned: true,
        hidden: false,
      });
    service.execute({
      projectId: project.id,
      path: 'f0',
      flag: 'hidden',
      value: true,
    });
    expect(preferences.find(project.id, 'f0')).toEqual({
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
    expect(preferences.count(project.id)).toBe(1999);
  });
});
