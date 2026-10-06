import { Effect } from 'effect';

import { describe, expect, it } from 'vitest';
import { QueryClient } from '@tanstack/query-core';
import type { Transport } from '@porcelain/client/transport';
import { createWorktreeConnection } from '@porcelain/client/transport';
import { ConnectionError, runRequest } from '@porcelain/client/transport';
import {
  FileDrafts,
  fileDraftRuntime,
  type FileDraftWriteFailure,
} from '@porcelain/client/files';
import { FileEditCoordinator } from './file-edit-coordinator.ts';

const scope = {
  projectId: 'project',
  worktreeId: '0123456789abcdef0123456789abcdef',
};
const key = (path: string) =>
  `${JSON.stringify([scope.projectId, scope.worktreeId])}/${path}`;

function setup(environmentId: string, transport: Transport) {
  const lifetime = createWorktreeConnection({
    environmentId,
    transport,
    timeoutMs: 1000,
  });
  const cache = new QueryClient();
  const coordinator = new FileEditCoordinator(
    lifetime.connection,
    scope,
    cache,
    () => 'command',
  );
  return {
    entries: () =>
      fileDraftRuntime.runSync(FileDrafts).entries(lifetime.connection),
    draft: (
      write: (input: {
        path: string;
        text: string;
        expectedFingerprint: string;
      }) => Effect.Effect<string, FileDraftWriteFailure>,
      isBlockedError: (error: unknown) => boolean,
    ) =>
      Effect.runPromise(
        fileDraftRuntime.runSync(FileDrafts).retain({
          environmentId,
          scope,
          path: 'source/file.txt',
          text: 'saved',
          fingerprint: 'version',
          writer: { write, isBlockedError },
        }),
      ),
    move: () =>
      runRequest(
        coordinator.execute({
          kind: 'move',
          path: 'source',
          destination: 'destination',
        }),
        lifetime.connection.request().signal,
      ),
    close: async () => {
      await Effect.runPromise(
        fileDraftRuntime.runSync(FileDrafts).drop(environmentId),
      );
      await lifetime.close();
      cache.clear();
    },
  };
}

describe('shared file edit coordination', () => {
  it('keeps draft locations after a rejected move and releases its ownership', async () => {
    const subject = setup('rejected-move', () =>
      Promise.resolve(new Response('unavailable', { status: 503 })),
    );
    const draft = await subject.draft(
      () => Effect.succeed('written'),
      () => false,
    );
    try {
      await expect(subject.move()).rejects.toMatchObject({ status: 503 });
      expect(subject.entries().get(key('source/file.txt'))).toBe(draft);
      expect(subject.entries().has(key('destination/file.txt'))).toBe(false);
      expect(draft.state.value.owner).toBeNull();
    } finally {
      await subject.close();
    }
  });

  it('refuses to send a move when a child draft could not be saved', async () => {
    let sent = 0;
    const subject = setup('unsaved-move', () => {
      sent += 1;
      return Promise.resolve(Response.json({ path: 'destination' }));
    });
    const draft = await subject.draft(
      () => Effect.fail(new ConnectionError({ message: 'Conflict' })),
      () => true,
    );
    await Effect.runPromise(draft.change('unsaved'));
    try {
      await expect(subject.move()).rejects.toThrow(
        'Save or discard the unsaved draft',
      );
      expect(sent).toBe(0);
      expect(subject.entries().get(key('source/file.txt'))).toBe(draft);
      expect(draft.state.value).toMatchObject({
        text: 'unsaved',
        savedText: 'saved',
        owner: null,
      });
    } finally {
      await subject.close();
    }
  });

  it('moves retained child drafts only after server confirmation', async () => {
    const writes: {
      path: string;
      text: string;
      expectedFingerprint: string;
    }[] = [];
    const subject = setup('confirmed-move', () =>
      Promise.resolve(Response.json({ path: 'destination' })),
    );
    const draft = await subject.draft(
      (input) =>
        Effect.sync(() => {
          writes.push(input);
          return 'written';
        }),
      () => false,
    );
    try {
      await expect(subject.move()).resolves.toEqual({ path: 'destination' });
      expect(subject.entries().has(key('source/file.txt'))).toBe(false);
      expect(subject.entries().get(key('destination/file.txt'))).toBe(draft);
      expect(draft.state.value.owner).toBeNull();
      await Effect.runPromise(draft.change('saved after relocation'));
      expect(await Effect.runPromise(draft.save())).toBe(true);
      expect(writes).toEqual([
        {
          path: 'destination/file.txt',
          text: 'saved after relocation',
          expectedFingerprint: 'version',
        },
      ]);
    } finally {
      await subject.close();
    }
  });
});
