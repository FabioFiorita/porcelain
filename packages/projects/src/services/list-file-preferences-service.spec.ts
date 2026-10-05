import { FilePreferenceStore } from '@porcelain/projects/ports';
import { Effect } from 'effect';
import { describe, expect, it } from 'vitest';
import { InMemoryFilePreferenceStore } from '../../spec/fakes/in-memory-file-preference-store.ts';
import { ListFilePreferencesService } from './list-file-preferences-service.ts';

function setup() {
  const preferences = new InMemoryFilePreferenceStore();
  const service = Effect.runSync(
    ListFilePreferencesService.pipe(
      Effect.provide(ListFilePreferencesService.layer),
      Effect.provideService(FilePreferenceStore, preferences),
    ),
  );
  return { preferences, service };
}

describe('ListFilePreferencesService', () => {
  it("answers the project's preferences ordered by path", async () => {
    const { preferences, service } = setup();
    await Effect.runPromise(
      preferences.save({
        projectId: 'api',
        preference: { path: 'src/b.ts', pinned: true, hidden: false },
      }),
    );
    await Effect.runPromise(
      preferences.save({
        projectId: 'api',
        preference: { path: 'README.md', pinned: false, hidden: true },
      }),
    );
    expect(Effect.runSync(service.execute({ projectId: 'api' }))).toEqual({
      preferences: [
        { path: 'README.md', pinned: false, hidden: true },
        { path: 'src/b.ts', pinned: true, hidden: false },
      ],
    });
  });

  it("never answers another project's preferences", async () => {
    const { preferences, service } = setup();
    await Effect.runPromise(
      preferences.save({
        projectId: 'web',
        preference: { path: 'index.html', pinned: true, hidden: false },
      }),
    );
    expect(Effect.runSync(service.execute({ projectId: 'api' }))).toEqual({
      preferences: [],
    });
  });
});
