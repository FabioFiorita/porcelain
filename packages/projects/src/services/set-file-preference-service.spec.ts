import {
  FilePreferenceStore,
  SetFilePreferenceOptions,
} from '@porcelain/projects/ports';
import { Effect } from 'effect';
import { describe, expect, it } from 'vitest';
import { FilePreferenceLimitError } from '@porcelain/projects/errors';
import { InMemoryFilePreferenceStore } from '../../spec/fakes/in-memory-file-preference-store.ts';
import { SetFilePreferenceService } from './set-file-preference-service.ts';

const project = { id: 'project-1' };

const LIMIT = 2000;

function setup() {
  const preferences = new InMemoryFilePreferenceStore();
  const service = Effect.runSync(
    SetFilePreferenceService.pipe(
      Effect.provide(SetFilePreferenceService.layer),
      Effect.provideService(FilePreferenceStore, preferences),
      Effect.provideService(SetFilePreferenceOptions, {
        maxPreferences: LIMIT,
      }),
    ),
  );
  return { preferences, service };
}

describe('SetFilePreferenceService', () => {
  it('pins a path and answers the full list', () => {
    const { service } = setup();
    expect(
      Effect.runSync(
        service.execute({
          projectId: project.id,
          path: 'README.md',
          flag: 'pinned',
          value: true,
        }),
      ),
    ).toEqual({
      preferences: [{ path: 'README.md', pinned: true, hidden: false }],
      changed: true,
    });
  });

  it('keeps the other flag when one flag changes', () => {
    const { service } = setup();
    Effect.runSync(
      service.execute({
        projectId: project.id,
        path: 'a.md',
        flag: 'pinned',
        value: true,
      }),
    );
    expect(
      Effect.runSync(
        service.execute({
          projectId: project.id,
          path: 'a.md',
          flag: 'hidden',
          value: true,
        }),
      ),
    ).toEqual({
      preferences: [{ path: 'a.md', pinned: true, hidden: true }],
      changed: true,
    });
  });

  it('forgets a path once neither flag is set', async () => {
    const { preferences, service } = setup();
    Effect.runSync(
      service.execute({
        projectId: project.id,
        path: 'a.md',
        flag: 'pinned',
        value: true,
      }),
    );
    expect(
      Effect.runSync(
        service.execute({
          projectId: project.id,
          path: 'a.md',
          flag: 'pinned',
          value: false,
        }),
      ),
    ).toEqual({ preferences: [], changed: true });
    expect(
      await Effect.runPromise(preferences.count({ projectId: project.id })),
    ).toBe(0);
  });

  it('stores nothing and reports no change when clearing a flag on a path without preferences', async () => {
    const { preferences, service } = setup();
    expect(
      Effect.runSync(
        service.execute({
          projectId: project.id,
          path: 'a.md',
          flag: 'hidden',
          value: false,
        }),
      ).changed,
    ).toBe(false);
    expect(
      await Effect.runPromise(preferences.count({ projectId: project.id })),
    ).toBe(0);
  });

  it('reports no change when a flag is set to the value it already has', () => {
    const { service } = setup();
    Effect.runSync(
      service.execute({
        projectId: project.id,
        path: 'a.md',
        flag: 'pinned',
        value: true,
      }),
    );
    expect(
      Effect.runSync(
        service.execute({
          projectId: project.id,
          path: 'a.md',
          flag: 'pinned',
          value: true,
        }),
      ),
    ).toEqual({
      preferences: [{ path: 'a.md', pinned: true, hidden: false }],
      changed: false,
    });
  });

  it('refuses a new path once the project holds as many preferences as allowed', async () => {
    const { preferences, service } = setup();
    for (let index = 0; index < LIMIT; index++)
      await Effect.runPromise(
        preferences.save({
          projectId: project.id,
          preference: { path: `f${index}`, pinned: true, hidden: false },
        }),
      );
    expect(() =>
      Effect.runSync(
        service.execute({
          projectId: project.id,
          path: 'new.md',
          flag: 'pinned',
          value: true,
        }),
      ),
    ).toThrow(FilePreferenceLimitError);
    expect(
      await Effect.runPromise(
        preferences.find({ projectId: project.id, path: 'new.md' }),
      ),
    ).toBeUndefined();
  });

  it('accepts the last preference the limit allows', async () => {
    const { preferences, service } = setup();
    for (let index = 0; index < LIMIT - 1; index++)
      await Effect.runPromise(
        preferences.save({
          projectId: project.id,
          preference: { path: `f${index}`, pinned: true, hidden: false },
        }),
      );
    Effect.runSync(
      service.execute({
        projectId: project.id,
        path: 'last.md',
        flag: 'pinned',
        value: true,
      }),
    );
    expect(
      await Effect.runPromise(preferences.count({ projectId: project.id })),
    ).toBe(LIMIT);
  });

  it('still changes and clears existing paths at the limit', async () => {
    const { preferences, service } = setup();
    for (let index = 0; index < LIMIT; index++)
      await Effect.runPromise(
        preferences.save({
          projectId: project.id,
          preference: { path: `f${index}`, pinned: true, hidden: false },
        }),
      );
    Effect.runSync(
      service.execute({
        projectId: project.id,
        path: 'f0',
        flag: 'hidden',
        value: true,
      }),
    );
    expect(
      await Effect.runPromise(
        preferences.find({ projectId: project.id, path: 'f0' }),
      ),
    ).toEqual({
      path: 'f0',
      pinned: true,
      hidden: true,
    });
    Effect.runSync(
      service.execute({
        projectId: project.id,
        path: 'f1',
        flag: 'pinned',
        value: false,
      }),
    );
    expect(
      await Effect.runPromise(preferences.count({ projectId: project.id })),
    ).toBe(LIMIT - 1);
  });
});
