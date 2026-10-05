import {
  WorktreePresenceStore,
  FilePreferenceStore,
} from '@porcelain/projects/ports';
import { Effect } from 'effect';
import { describe, expect, it } from 'vitest';
import { InMemoryFilePreferenceStore } from '../../spec/fakes/in-memory-file-preference-store.ts';
import { InMemoryWorktreePresenceStore } from '../../spec/fakes/in-memory-worktree-presence-store.ts';
import { ForgetProjectRecordsService } from './forget-project-records-service.ts';

async function setup() {
  const presence = new InMemoryWorktreePresenceStore();
  await Effect.runPromise(
    presence.save({
      rows: [
        { worktreeId: 'api-main', projectId: 'api', missingSince: undefined },
        {
          worktreeId: 'api-old',
          projectId: 'api',
          missingSince: '2026-08-01T00:00:00.000Z',
        },
        { worktreeId: 'web-main', projectId: 'web', missingSince: undefined },
      ],
    }),
  );
  const preferences = new InMemoryFilePreferenceStore([
    {
      projectId: 'api',
      preference: { path: 'README.md', pinned: true, hidden: false },
    },
    {
      projectId: 'web',
      preference: { path: 'index.html', pinned: false, hidden: true },
    },
  ]);
  return {
    presence,
    preferences,
    service: Effect.runSync(
      ForgetProjectRecordsService.pipe(
        Effect.provide(ForgetProjectRecordsService.layer),
        Effect.provideService(WorktreePresenceStore, presence),
        Effect.provideService(FilePreferenceStore, preferences),
      ),
    ),
  };
}

describe('ForgetProjectRecordsService', () => {
  it("forgets every worktree the project recorded, present or absent, and the project's file preferences", async () => {
    const { presence, preferences, service } = await setup();
    Effect.runSync(service.execute({ projectId: 'api' }));
    expect(
      await Effect.runPromise(presence.read({ projectId: 'api' })),
    ).toEqual([]);
    expect(
      await Effect.runPromise(preferences.list({ projectId: 'api' })),
    ).toEqual([]);
  });

  it("keeps other projects' worktrees and preferences", async () => {
    const { presence, preferences, service } = await setup();
    Effect.runSync(service.execute({ projectId: 'api' }));
    expect(await Effect.runPromise(presence.list())).toEqual([
      { worktreeId: 'web-main', projectId: 'web', missingSince: undefined },
    ]);
    expect(
      await Effect.runPromise(preferences.list({ projectId: 'web' })),
    ).toEqual([{ path: 'index.html', pinned: false, hidden: true }]);
  });
});
