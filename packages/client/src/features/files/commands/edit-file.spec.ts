import { Layer, Effect, ManagedRuntime, Exit } from 'effect';
import { type EditFileRequest } from '@porcelain/contracts/files';

import { describe, expect } from 'vitest';
import { it } from '@effect/vitest';
import { AtomRegistry } from 'effect/reactivity';
import { ContentChangedError } from '@porcelain/files/errors';
import type { Transport } from '@porcelain/client/transport';
import { createWorktreeConnection } from '@porcelain/client/transport';
import { ConnectionError } from '@porcelain/client/transport';
import {
  FileDrafts,
  type FileDraftWriteFailure,
} from '@porcelain/client/files';
import {
  editFile,
  retainFileDraft,
  moveFileEntries,
  completeFileDraft,
} from './edit-file.ts';

const scope = {
  projectId: 'project',
  worktreeId: '0123456789abcdef0123456789abcdef',
};
const key = (path: string) =>
  `${JSON.stringify([scope.projectId, scope.worktreeId])}/${path}`;

function setup(
  environmentId: string,
  transport: Transport,
  sharedApplication?: ManagedRuntime.ManagedRuntime<FileDrafts, never>,
) {
  const application =
    sharedApplication ?? ManagedRuntime.make(FileDrafts.layer);
  application.runSync(FileDrafts);
  const lifetime = createWorktreeConnection(
    {
      environmentId,
      transport,
      timeoutMs: 1000,
    },
    application.memoMap,
    Layer.empty,
  );
  const registry = AtomRegistry.make();
  const command = editFile({ connection: lifetime.connection, scope });
  const executeEffect = Effect.fnUntraced(function* (input: EditFileRequest) {
    registry.set(command, input);
    return yield* AtomRegistry.getResult(registry, command, {
      suspendOnWaiting: true,
    });
  });
  const execute = (input: EditFileRequest) =>
    Effect.runPromise(executeEffect(input));
  return {
    entries: () => application.runSync(FileDrafts).entries(lifetime.connection),
    draft: (
      write: (input: {
        path: string;
        text: string;
        expectedFingerprint: string;
      }) => Effect.Effect<string, FileDraftWriteFailure>,
      isBlockedError: (error: unknown) => boolean,
    ) =>
      Effect.runPromise(
        application.runSync(FileDrafts).retain({
          environmentId,
          scope,
          path: 'source/file.txt',
          text: 'saved',
          fingerprint: 'version',
          writer: { write, isBlockedError },
        }),
      ),
    move: () =>
      execute({
        kind: 'move',
        path: 'source',
        destination: 'destination',
      }),
    registry,
    connection: lifetime.connection,
    execute,
    executeEffect,
    close: async () => {
      await Effect.runPromise(
        application.runSync(FileDrafts).drop(environmentId),
      );
      await lifetime.close();
      registry.dispose();
      if (!sharedApplication) await application.dispose();
    },
  };
}

describe('shared file edit coordination', () => {
  it('keeps drafts in separate applications isolated even when their environment and path match', async () => {
    const first = setup('same-environment', () =>
      Promise.resolve(Response.json({ path: 'destination' })),
    );
    const second = setup('same-environment', () =>
      Promise.resolve(Response.json({ path: 'destination' })),
    );
    let firstClosed = false;
    try {
      const firstDraft = await first.draft(
        () => Effect.succeed('first-version'),
        () => false,
      );
      const secondDraft = await second.draft(
        () => Effect.succeed('second-version'),
        () => false,
      );
      await Effect.runPromise(firstDraft.change('First application'));
      await Effect.runPromise(secondDraft.change('Second application'));
      expect(firstDraft).not.toBe(secondDraft);
      expect(firstDraft.state.value.text).toBe('First application');
      expect(secondDraft.state.value.text).toBe('Second application');
      await first.close();
      firstClosed = true;
      expect(firstDraft.claim('editor')).toBe(false);
      expect(await Effect.runPromise(secondDraft.save())).toBe(true);
      expect(secondDraft.state.value).toMatchObject({
        text: 'Second application',
        savedText: 'Second application',
        fingerprint: 'second-version',
      });
    } finally {
      if (!firstClosed) await first.close();
      await second.close();
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

it('cancels a disconnected move, releases its draft claims, and rejects a late confirmation', async () => {
  const started = Promise.withResolvers<void>();
  const held = Promise.withResolvers<Response>();
  const subject = setup('disconnected-move', () => {
    started.resolve();
    return held.promise;
  });
  const draft = await subject.draft(
    () => Effect.succeed('written'),
    () => false,
  );
  try {
    const completed = subject.move();
    const rejected = expect(completed).rejects.toThrow();
    await started.promise;
    expect(typeof draft.state.value.owner).toBe('symbol');
    void subject.connection.close();
    held.resolve(Response.json({ path: 'destination' }));
    await rejected;
    expect(draftLocations(subject, draft)).toEqual({
      source: draft,
      destination: undefined,
      owner: null,
    });
  } finally {
    held.resolve(Response.json({ path: 'destination' }));
    await subject.close();
  }
});

it('refuses to send a move while a child is owned by an editor', async () => {
  let sent = 0;
  const subject = setup('owned-child', () => {
    sent += 1;
    return Promise.resolve(Response.json({ path: 'destination' }));
  });
  const draft = await subject.draft(
    () => Effect.succeed('written'),
    () => false,
  );
  draft.claim('editor');
  try {
    await expect(subject.move()).rejects.toThrow('Finish editing this file');
    expect(sent).toBe(0);
    expect(draft.state.value.owner).toBe('editor');
  } finally {
    draft.release('editor');
    await subject.close();
  }
});

it('saves a retained draft through the adopted connection after its original connection closes', async () => {
  let staleWrites = 0;
  const application = ManagedRuntime.make(FileDrafts.layer);
  const original = setup(
    'adopted-draft',
    () => {
      staleWrites += 1;
      return Promise.resolve(Response.json({ path: 'README.md' }));
    },
    application,
  );
  const sent: { path: string; body: string }[] = [];
  const replacement = setup(
    'adopted-draft',
    (path, init) => {
      const bytes = init?.body;
      if (!(bytes instanceof Uint8Array))
        throw new Error('Expected request bytes');
      sent.push({ path, body: new TextDecoder().decode(bytes) });
      return Promise.resolve(
        Response.json({
          path: 'README.md',
          contentFingerprint: 'b'.repeat(64),
        }),
      );
    },
    application,
  );
  const draft = await Effect.runPromise(
    AtomRegistry.getResult(
      original.registry,
      retainFileDraft({
        connection: original.connection,
        scope,
        path: 'README.md',
        text: 'Saved',
        fingerprint: 'a'.repeat(64),
      }),
    ),
  );
  try {
    await original.connection.close();
    application.runSync(FileDrafts).adopt(replacement.connection);
    await Effect.runPromise(draft.change('New text'));
    expect(await Effect.runPromise(draft.save())).toBe(true);
    expect(draft.state.value).toMatchObject({
      text: 'New text',
      savedText: 'New text',
      fingerprint: 'b'.repeat(64),
      saving: false,
      error: null,
    });
    expect(staleWrites).toBe(0);
    expect(sent).toEqual([
      {
        path: `/api/worktrees/${scope.worktreeId}/files`,
        body: JSON.stringify({
          kind: 'write',
          path: 'README.md',
          text: 'New text',
          expectedFingerprint: 'a'.repeat(64),
        }),
      },
    ]);
  } finally {
    await original.close();
    await replacement.close();
    await application.dispose();
  }
});

it('encodes a validated write and refuses an invalid fingerprint before transport', async () => {
  const sent: RequestInit[] = [];
  const subject = setup('validated-write', (_, init) => {
    if (init) sent.push(init);
    return Promise.resolve(Response.json({ path: 'README.md' }));
  });
  const write = {
    kind: 'write' as const,
    path: 'README.md',
    text: 'Saved',
    expectedFingerprint: 'a'.repeat(64),
  };
  try {
    expect(await subject.execute(write)).toEqual({ path: 'README.md' });
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      cache: 'no-store',
      redirect: 'error',
    });
    const bytes = sent[0]?.body;
    if (!(bytes instanceof Uint8Array))
      throw new Error('Expected request bytes');
    expect(new TextDecoder().decode(bytes)).toBe(JSON.stringify(write));
    await expect(
      subject.execute({ ...write, expectedFingerprint: 'bad' }),
    ).rejects.toThrow();
    expect(sent).toHaveLength(1);
  } finally {
    await subject.close();
  }
});

it.each([409, 422])(
  'decodes a content conflict only at its declared status, received %s',
  async (status) => {
    const subject = setup(`conflict-status-${status}`, () =>
      Promise.resolve(
        Response.json(
          {
            statusCode: status,
            error: 'Conflict',
            message: 'Content changed; retry the operation',
            code: 'content_changed',
          },
          { status },
        ),
      ),
    );
    try {
      const failure = await subject
        .execute({
          kind: 'write',
          path: 'README.md',
          text: 'Saved',
          expectedFingerprint: 'a'.repeat(64),
        })
        .catch((error: unknown) => error);
      expect(failure instanceof ContentChangedError).toBe(status === 409);
    } finally {
      await subject.close();
    }
  },
);

it.effect(
  'moves top-level entries in order and stops the batch at the first refused move',
  () =>
    Effect.gen(function* () {
      const sent: string[] = [];
      const subject = yield* Effect.acquireRelease(
        Effect.sync(() =>
          setup('batch', (_path, init) => {
            if (!(init?.body instanceof Uint8Array))
              throw new Error('Expected request bytes');
            sent.push(new TextDecoder().decode(init.body));
            return Promise.resolve(
              sent.length === 1
                ? Response.json({ path: 'destination/source' })
                : Response.json(
                    { statusCode: 409, message: 'Destination exists' },
                    { status: 409 },
                  ),
            );
          }),
        ),
        (subject) => Effect.promise(subject.close),
      );
      const result = yield* Effect.exit(
        moveFileEntries(
          [
            'source/',
            'source/file.txt',
            'destination/source/',
            'second.txt',
            'third.txt',
          ],
          'destination/',
          (path, destination) =>
            subject
              .executeEffect({
                kind: 'move',
                path: path.replace(/\/$/, ''),
                destination,
              })
              .pipe(Effect.asVoid),
        ),
      );
      expect(Exit.isFailure(result)).toBe(true);
      expect(sent).toEqual([
        JSON.stringify({
          kind: 'move',
          path: 'source',
          destination: 'destination/source',
        }),
        JSON.stringify({
          kind: 'move',
          path: 'second.txt',
          destination: 'destination/second.txt',
        }),
      ]);
    }),
);

it.effect('completes an editor only after its real draft confirms a save', () =>
  Effect.gen(function* () {
    let refused = true;
    let completed = 0;
    const subject = yield* Effect.acquireRelease(
      Effect.sync(() =>
        setup('completion', () =>
          Promise.resolve(Response.json({ path: 'destination' })),
        ),
      ),
      (subject) => Effect.promise(subject.close),
    );
    const draft = yield* Effect.promise(() =>
      subject.draft(
        () =>
          refused
            ? Effect.fail(new ConnectionError({ message: 'Keep the draft' }))
            : Effect.succeed('confirmed'),
        () => false,
      ),
    );
    yield* draft.change('Unsaved text');
    yield* completeFileDraft(draft, () => {
      completed++;
    });
    expect(completed).toBe(0);
    expect(draft.state.value.savedText).toBe('saved');
    expect(draft.state.value.text).toBe('Unsaved text');
    refused = false;
    yield* completeFileDraft(draft, () => {
      completed++;
    });
    expect(completed).toBe(1);
    expect(draft.state.value.savedText).toBe('Unsaved text');
    expect(draft.state.value.fingerprint).toBe('confirmed');
  }),
);

it.each([
  {
    reason: 'rejected move',
    response: () => new Response('unavailable', { status: 503 }),
    error: { status: 503 },
  },
  {
    reason: 'wrong destination',
    response: () => Response.json({ path: 'another-folder' }),
    error: {
      message:
        'The connected context changed. Reopen Porcelain to continue safely.',
    },
  },
])(
  'keeps original draft locations and releases ownership after $reason',
  async ({ reason, response, error }) => {
    const subject = setup(reason, () => Promise.resolve(response()));
    const draft = await subject.draft(
      () => Effect.succeed('written'),
      () => false,
    );
    try {
      await expect(subject.move()).rejects.toMatchObject(error);
      expect(subject.entries().get(key('source/file.txt'))).toBe(draft);
      expect(subject.entries().has(key('destination/file.txt'))).toBe(false);
      expect(draft.state.value.owner).toBeNull();
    } finally {
      await subject.close();
    }
  },
);

function draftLocations(
  subject: ReturnType<typeof setup>,
  draft: Awaited<ReturnType<ReturnType<typeof setup>['draft']>>,
) {
  return {
    source: subject.entries().get(key('source/file.txt')),
    destination: subject.entries().get(key('destination/file.txt')),
    owner: draft.state.value.owner,
  };
}
