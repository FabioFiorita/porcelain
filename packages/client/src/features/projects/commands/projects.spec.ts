import { afterEach } from 'vitest';
import { ManagedRuntime } from 'effect';
import { WriteQueues } from '@porcelain/client/transport';
import { expect, it } from 'vitest';
import { Effect } from 'effect';
import { QueryClient } from '@tanstack/query-core';
import { FileDrafts, fileDraftRuntime } from '@porcelain/client/files';
import { ContentChangedError } from '@porcelain/files/errors';
import { runClientRequest } from '@porcelain/client/transport';
import { inventoryQueryOptions } from '@porcelain/client/projects';
import { projectCommands } from './projects.ts';

const projectId = '00000000-0000-4000-8000-000000000001';
const worktreeId = 'a'.repeat(32);
function connection(steps: string[]) {
  const signal = new AbortController().signal;
  return {
    environmentId: 'environment',
    request: () => ({ signal }),
    transport: (path: string) => {
      steps.push(path);
      return Promise.resolve(Response.json({ deleted: true }));
    },
  };
}

it('saves a retained project draft before removing the project and updating inventory', async () => {
  const requestRuntime = runtimeFixture();

  const steps: string[] = [];
  const connected = connection(steps);
  const cache = new QueryClient();
  const key = inventoryQueryOptions(connected).queryKey;
  cache.setQueryData(key, { projects: [{ id: projectId, name: 'Project' }] });
  const draft = Effect.runSync(
    fileDraftRuntime.runSync(FileDrafts).retain({
      environmentId: connected.environmentId,
      scope: { projectId, worktreeId },
      path: 'README.md',
      text: 'original',
      fingerprint: 'version-1',
      writer: {
        write: () =>
          Effect.sync(() => {
            steps.push('draft saved');
            return 'version-2';
          }),
      },
    }),
  );
  try {
    await Effect.runPromise(draft.change('updated'));
    expect(
      await runClientRequest(
        projectCommands(connected, cache).remove(projectId),
        connected.request().signal,
        requestRuntime,
      ),
    ).toEqual({ deleted: true });
    expect(steps).toEqual(['draft saved', `/api/projects/${projectId}`]);
    expect(draft.state.value).toMatchObject({
      text: 'updated',
      savedText: 'updated',
      fingerprint: 'version-2',
    });
    expect(cache.getQueryData(key)).toEqual({ projects: [] });
  } finally {
    await Effect.runPromise(draft.dispose());
    cache.clear();
  }
});

it('keeps the project and its unsaved draft when a save conflicts', async () => {
  const requestRuntime = runtimeFixture();

  const steps: string[] = [];
  const connected = connection(steps);
  const cache = new QueryClient();
  const key = inventoryQueryOptions(connected).queryKey;
  const inventory = { projects: [{ id: projectId, name: 'Project' }] };
  cache.setQueryData(key, inventory);
  const draft = Effect.runSync(
    fileDraftRuntime.runSync(FileDrafts).retain({
      environmentId: connected.environmentId,
      scope: { projectId, worktreeId },
      path: 'README.md',
      text: 'original',
      fingerprint: 'version-1',
      writer: { write: () => Effect.fail(new ContentChangedError()) },
    }),
  );
  try {
    await Effect.runPromise(draft.change('unsaved'));
    await expect(
      runClientRequest(
        projectCommands(connected, cache).remove(projectId),
        connected.request().signal,
        requestRuntime,
      ),
    ).rejects.toThrow(
      'Save or discard unsaved file drafts before removing this project.',
    );
    expect(steps).toEqual([]);
    expect(cache.getQueryData(key)).toEqual(inventory);
    expect(draft.state.value).toMatchObject({
      text: 'unsaved',
      savedText: 'original',
      fingerprint: 'version-1',
    });
  } finally {
    await Effect.runPromise(draft.dispose());
    cache.clear();
  }
});

it('leaves another project draft alone when removing the selected project', async () => {
  const requestRuntime = runtimeFixture();

  const steps: string[] = [];
  const connected = connection(steps);
  const cache = new QueryClient();
  const draft = Effect.runSync(
    fileDraftRuntime.runSync(FileDrafts).retain({
      environmentId: connected.environmentId,
      scope: { projectId: 'other-project', worktreeId },
      path: 'README.md',
      text: 'original',
      fingerprint: 'version-1',
      writer: {
        write: () =>
          Effect.sync(() => {
            steps.push('other draft saved');
            return 'version-2';
          }),
      },
    }),
  );
  try {
    await Effect.runPromise(draft.change('unsaved'));
    expect(
      await runClientRequest(
        projectCommands(connected, cache).remove(projectId),
        connected.request().signal,
        requestRuntime,
      ),
    ).toEqual({ deleted: true });
    expect(steps).toEqual([`/api/projects/${projectId}`]);
    expect(draft.state.value).toMatchObject({
      text: 'unsaved',
      savedText: 'original',
      fingerprint: 'version-1',
    });
  } finally {
    await Effect.runPromise(draft.dispose());
    cache.clear();
  }
});

const runtimes = new Set<ManagedRuntime.ManagedRuntime<WriteQueues, never>>();
function runtimeFixture() {
  const runtime = ManagedRuntime.make(WriteQueues.layer);
  runtimes.add(runtime);
  return runtime;
}
afterEach(async () => {
  for (const runtime of runtimes) await runtime.dispose();
  runtimes.clear();
});
