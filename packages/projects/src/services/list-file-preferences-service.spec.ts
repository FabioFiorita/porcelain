import { describe, expect, it } from 'vitest';
import { ProjectNotFoundError } from '@porcelain/projects/errors';
import type { RegisteredProject } from '@porcelain/projects/models';
import { InMemoryFilePreferenceStore } from '../../spec/fakes/in-memory-file-preference-store.ts';
import { InMemoryInventoryStore } from '../../spec/fakes/in-memory-inventory-store.ts';
import { ListFilePreferencesService } from './list-file-preferences-service.ts';

function project(id: string): RegisteredProject {
  return {
    id,
    name: id,
    namedByOwner: false,
    commonDirectory: `/srv/${id}/.git`,
    repositoryIdentity: `identity-${id}`,
    available: true,
    position: 1,
  };
}

function setup() {
  const preferences = new InMemoryFilePreferenceStore();
  const service = new ListFilePreferencesService(
    new InMemoryInventoryStore('environment', [project('api'), project('web')]),
    preferences,
  );
  return { preferences, service };
}

describe('ListFilePreferencesService', () => {
  it("answers the project's preferences ordered by path", () => {
    const { preferences, service } = setup();
    preferences.save({
      projectId: 'api',
      preference: { path: 'src/b.ts', pinned: true, hidden: false },
    });
    preferences.save({
      projectId: 'api',
      preference: { path: 'README.md', pinned: false, hidden: true },
    });
    expect(service.execute({ projectId: 'api' })).toEqual({
      preferences: [
        { path: 'README.md', pinned: false, hidden: true },
        { path: 'src/b.ts', pinned: true, hidden: false },
      ],
    });
  });

  it("never answers another project's preferences", () => {
    const { preferences, service } = setup();
    preferences.save({
      projectId: 'web',
      preference: { path: 'index.html', pinned: true, hidden: false },
    });
    expect(service.execute({ projectId: 'api' })).toEqual({ preferences: [] });
  });

  it('refuses a project that is not registered', () => {
    const { service } = setup();
    expect(() => service.execute({ projectId: 'unknown' })).toThrow(
      ProjectNotFoundError,
    );
  });
});
