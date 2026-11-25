import { temporaryRoot } from '@porcelain/kernel/test-kit/temporary-root';
import { NodeServices } from '@effect/platform-node';
import { Effect, Layer, ManagedRuntime } from 'effect';
import { afterEach, expect, it } from 'vite-plus/test';
import {
  InventoryStore,
  WorktreePresenceStore,
} from '@porcelain/projects/ports';
import { DraftCommentStore } from '@porcelain/reviews/ports';
import { storageLayer } from '../../index.ts';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const worktreeId = 'a'.repeat(32);
const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
});

async function open(dataDirectory: string) {
  const session = ManagedRuntime.make(
    storageLayer(dataDirectory, {
      worktreeIdLength: 32,
      busyTimeoutMs: 5000,
    }).pipe(Layer.provide(NodeServices.layer)),
  );
  return { session, store: await session.runPromise(DraftCommentStore) };
}

it('keeps drafts across a restart, per branch, and records their publication', async () => {
  const dataDirectory = mkdtempSync(join(temporaryRoot, 'porcelain-drafts-'));
  cleanups.push(async () =>
    rmSync(dataDirectory, { recursive: true, force: true }),
  );
  const first = await open(dataDirectory);
  await Effect.runPromise(
    (await first.session.runPromise(InventoryStore)).save({
      id: 'project',
      name: 'project',
      namedByOwner: false,
      commonDirectory: '/repositories/project/.git',
      repositoryIdentity: 'identity-project',
      available: true,
      position: 1,
    }),
  );
  await Effect.runPromise(
    (await first.session.runPromise(WorktreePresenceStore)).save({
      rows: [{ worktreeId, projectId: 'project', missingSince: undefined }],
    }),
  );
  const base = {
    worktreeId,
    branch: 'feature/search',
    headOid: 'c'.repeat(40),
    createdAt: '2026-11-25T10:00:00.000Z',
    updatedAt: '2026-11-25T10:00:00.000Z',
    publication: { status: 'draft' as const },
  };
  await Effect.runPromise(
    Effect.gen(function* () {
      yield* first.store.insert({
        ...base,
        id: 'one',
        anchor: {
          kind: 'lines',
          path: 'src/a.ts',
          side: 'additions',
          start: 2,
          end: 4,
          text: 'b\nc\nd',
        },
        text: 'First',
      });
      yield* first.store.insert({
        ...base,
        id: 'two',
        anchor: { kind: 'node', title: 'Search', node: 'findNotes' },
        text: 'Second',
      });
      yield* first.store.insert({
        ...base,
        id: 'other-branch',
        branch: 'main',
        anchor: { kind: 'file', path: 'README.md' },
        text: 'Elsewhere',
      });
      yield* first.store.updateText({
        worktreeId,
        id: 'two',
        text: 'Second, edited',
        updatedAt: '2026-11-25T11:00:00.000Z',
      });
      yield* first.store.markPublished({
        worktreeId,
        ids: ['one'],
        url: 'https://github.com/o/r/pull/1#pullrequestreview-2',
        publishedAt: '2026-11-25T12:00:00.000Z',
      });
    }),
  );
  await first.session.dispose();

  const second = await open(dataDirectory);
  cleanups.push(() => second.session.dispose());
  const listed = await Effect.runPromise(
    second.store.list({ worktreeId, branch: 'feature/search' }),
  );
  expect(listed).toEqual([
    {
      ...base,
      id: 'one',
      anchor: {
        kind: 'lines',
        path: 'src/a.ts',
        side: 'additions',
        start: 2,
        end: 4,
        text: 'b\nc\nd',
      },
      text: 'First',
      publication: {
        status: 'published',
        url: 'https://github.com/o/r/pull/1#pullrequestreview-2',
        publishedAt: '2026-11-25T12:00:00.000Z',
      },
    },
    {
      ...base,
      id: 'two',
      anchor: { kind: 'node', title: 'Search', node: 'findNotes' },
      text: 'Second, edited',
      updatedAt: '2026-11-25T11:00:00.000Z',
    },
  ]);
  await Effect.runPromise(second.store.remove({ worktreeId, id: 'two' }));
  expect(
    await Effect.runPromise(second.store.find({ worktreeId, id: 'two' })),
  ).toBe(undefined);
});
