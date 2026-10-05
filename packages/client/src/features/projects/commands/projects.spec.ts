import { expect, it } from 'vitest';
import { Effect } from 'effect';
import { QueryClient } from '@tanstack/query-core';
import { FileDraft, retainedFileDrafts } from '@porcelain/client/files';
import { ContentChangedError } from '@porcelain/files/errors';
import { runRequest } from '@porcelain/client/transport';
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
  const steps: string[] = [];
  const connected = connection(steps);
  const cache = new QueryClient();
  const key = inventoryQueryOptions(connected).queryKey;
  cache.setQueryData(key, { projects: [{ id: projectId, name: 'Project' }] });
  const draft = new FileDraft('original', 'version-1', () =>
    Effect.sync(() => {
      steps.push('draft saved');
      return 'version-2';
    }),
  );
  const drafts = retainedFileDrafts(connected);
  const draftKey = `${JSON.stringify([projectId, worktreeId])}/README.md`;
  drafts.set(draftKey, draft);
  try {
    draft.change('updated');
    expect(
      await runRequest(
        projectCommands(connected, cache).remove(projectId),
        connected.request().signal,
      ),
    ).toEqual({ deleted: true });
    expect(steps).toEqual(['draft saved', `/api/projects/${projectId}`]);
    expect(draft.snapshot()).toMatchObject({
      text: 'updated',
      savedText: 'updated',
      fingerprint: 'version-2',
    });
    expect(cache.getQueryData(key)).toEqual({ projects: [] });
  } finally {
    drafts.delete(draftKey);
    await Effect.runPromise(draft.dispose());
    cache.clear();
  }
});

it('keeps the project and its unsaved draft when a save conflicts', async () => {
  const steps: string[] = [];
  const connected = connection(steps);
  const cache = new QueryClient();
  const key = inventoryQueryOptions(connected).queryKey;
  const inventory = { projects: [{ id: projectId, name: 'Project' }] };
  cache.setQueryData(key, inventory);
  const draft = new FileDraft('original', 'version-1', () =>
    Effect.fail(new ContentChangedError()),
  );
  const drafts = retainedFileDrafts(connected);
  const draftKey = `${JSON.stringify([projectId, worktreeId])}/README.md`;
  drafts.set(draftKey, draft);
  try {
    draft.change('unsaved');
    await expect(
      runRequest(
        projectCommands(connected, cache).remove(projectId),
        connected.request().signal,
      ),
    ).rejects.toThrow(
      'Save or discard unsaved file drafts before removing this project.',
    );
    expect(steps).toEqual([]);
    expect(cache.getQueryData(key)).toEqual(inventory);
    expect(draft.snapshot()).toMatchObject({
      text: 'unsaved',
      savedText: 'original',
      fingerprint: 'version-1',
    });
  } finally {
    drafts.delete(draftKey);
    await Effect.runPromise(draft.dispose());
    cache.clear();
  }
});

it('leaves another project draft alone when removing the selected project', async () => {
  const steps: string[] = [];
  const connected = connection(steps);
  const cache = new QueryClient();
  const draft = new FileDraft('original', 'version-1', () =>
    Effect.sync(() => {
      steps.push('other draft saved');
      return 'version-2';
    }),
  );
  const drafts = retainedFileDrafts(connected);
  const draftKey = `${JSON.stringify(['other-project', worktreeId])}/README.md`;
  drafts.set(draftKey, draft);
  try {
    draft.change('unsaved');
    expect(
      await runRequest(
        projectCommands(connected, cache).remove(projectId),
        connected.request().signal,
      ),
    ).toEqual({ deleted: true });
    expect(steps).toEqual([`/api/projects/${projectId}`]);
    expect(draft.snapshot()).toMatchObject({
      text: 'unsaved',
      savedText: 'original',
      fingerprint: 'version-1',
    });
  } finally {
    drafts.delete(draftKey);
    await Effect.runPromise(draft.dispose());
    cache.clear();
  }
});
