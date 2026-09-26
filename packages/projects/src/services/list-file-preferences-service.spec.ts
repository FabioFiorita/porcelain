import { describe, expect, it } from 'vitest';
import { InMemoryFilePreferenceStore } from '../../spec/fakes/in-memory-file-preference-store.ts';
import { ListFilePreferencesService } from './list-file-preferences-service.ts';

function setup() {
  const preferences = new InMemoryFilePreferenceStore();
  const service = new ListFilePreferencesService(preferences);
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
});
