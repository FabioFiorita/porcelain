import { CommentStore } from '@porcelain/reviews/ports';
import { Effect } from 'effect';
import { describe, expect, it } from 'vitest';
import {
  type CommentAuthorRole,
  type DeleteResolvedCommentsInput,
} from '@porcelain/reviews/models';
import { InMemoryCommentStore } from '../../spec/fakes/in-memory-comment-store.ts';
import { DeleteResolvedCommentsService } from './delete-resolved-comments-service.ts';

const worktreeId = 'a'.repeat(64);
const otherWorktreeId = 'b'.repeat(64);

async function thread(
  store: InMemoryCommentStore,
  id: string,
  authors: readonly CommentAuthorRole[],
  options: { resolved: boolean; worktreeId?: string },
) {
  const opened = await Effect.runPromise(
    store.insert({
      content: {
        id,
        worktreeId: options.worktreeId ?? worktreeId,
        anchor: { kind: 'file', filePath: 'README.md' },
        messages: authors.map((author, index) => ({
          id: `${id}-${index}`,
          body: `Message ${index} of ${id}`,
          author,
        })),
      },
      sizeBytes: 100,
      writtenByAgent: authors.at(-1) === 'agent',
    }),
  );
  if (options.resolved)
    await Effect.runPromise(store.resolve({ thread: opened, resolved: true }));
}

async function setup() {
  const store = new InMemoryCommentStore();
  await thread(store, 'answered', ['reviewer', 'agent'], { resolved: true });
  await thread(store, 'noted', ['reviewer'], { resolved: true });
  await thread(store, 'open', ['reviewer', 'agent'], { resolved: false });
  await thread(store, 'from-agent', ['agent', 'reviewer'], { resolved: true });
  await thread(store, 'elsewhere', ['reviewer'], {
    resolved: true,
    worktreeId: otherWorktreeId,
  });
  return {
    store,
    service: Effect.runSync(
      DeleteResolvedCommentsService.pipe(
        Effect.provide(DeleteResolvedCommentsService.layer),
        Effect.provideService(CommentStore, store),
      ),
    ),
  };
}

const ids = async (store: InMemoryCommentStore, id = worktreeId) =>
  (await Effect.runPromise(store.list({ worktreeId: id }))).map(
    (entry) => entry.id,
  );
const device: DeleteResolvedCommentsInput['writer'] = { kind: 'device' };
const confirmed = async (store: InMemoryCommentStore, ...threadIds: string[]) =>
  await Promise.all(
    threadIds.map(async (threadId) => ({
      threadId,
      revision:
        (await Effect.runPromise(store.find({ threadId })))?.revision ?? 0,
    })),
  );

describe('DeleteResolvedCommentsService', () => {
  it('deletes the confirmed resolved threads the reviewer started, the agent replies in them included', async () => {
    const { store, service } = await setup();
    const result = Effect.runSync(
      service.execute({
        worktreeId,
        writer: device,
        threads: await confirmed(store, 'answered', 'noted'),
      }),
    );
    expect(result).toEqual({ deleted: ['answered', 'noted'], skipped: [] });
    expect(await ids(store)).toEqual(['open', 'from-agent']);
    expect(
      await Effect.runPromise(store.findMessage({ messageId: 'answered-1' })),
    ).toBeUndefined();
  });

  it('keeps a confirmed thread the agent answered after the reviewer confirmed', async () => {
    const { store, service } = await setup();
    const threads = await confirmed(store, 'answered', 'noted');
    const answered = await Effect.runPromise(
      store.find({ threadId: 'answered' }),
    );
    if (answered)
      await Effect.runPromise(
        store.append({
          thread: answered,
          message: { id: 'late', body: 'One more thing', author: 'agent' },
          sizeBytes: 150,
          writtenByAgent: true,
        }),
      );
    const result = Effect.runSync(
      service.execute({ worktreeId, writer: device, threads }),
    );
    expect(result).toEqual({ deleted: ['noted'], skipped: ['answered'] });
    expect(
      (await Effect.runPromise(store.findMessage({ messageId: 'late' })))?.body,
    ).toBe('One more thing');
  });

  it('keeps a confirmed thread that was reopened', async () => {
    const { store, service } = await setup();
    const threads = await confirmed(store, 'noted');
    const noted = await Effect.runPromise(store.find({ threadId: 'noted' }));
    if (noted)
      await Effect.runPromise(
        store.resolve({ thread: noted, resolved: false }),
      );
    expect(
      Effect.runSync(service.execute({ worktreeId, writer: device, threads })),
    ).toEqual({
      deleted: [],
      skipped: ['noted'],
    });
    expect(await ids(store)).toContain('noted');
  });

  it('keeps an open thread, a thread the agent started and a thread of another worktree even when named', async () => {
    const { store, service } = await setup();
    const result = Effect.runSync(
      service.execute({
        worktreeId,
        writer: device,
        threads: await confirmed(
          store,
          'open',
          'from-agent',
          'elsewhere',
          'unknown',
        ),
      }),
    );
    expect(result).toEqual({
      deleted: [],
      skipped: ['open', 'from-agent', 'elsewhere', 'unknown'],
    });
    expect(await ids(store)).toEqual([
      'answered',
      'noted',
      'open',
      'from-agent',
    ]);
    expect(await ids(store, otherWorktreeId)).toEqual(['elsewhere']);
  });

  it('writes as the reviewer for the owner as for a paired device', async () => {
    const { store, service } = await setup();
    Effect.runSync(
      service.execute({
        worktreeId,
        writer: { kind: 'owner' },
        threads: await confirmed(store, 'noted'),
      }),
    );
    expect(await ids(store)).not.toContain('noted');
  });

  it("deletes only the agent's own resolved threads when the agent asks", async () => {
    const { store, service } = await setup();
    expect(
      Effect.runSync(
        service.execute({
          worktreeId,
          writer: { kind: 'agent' },
          threads: await confirmed(store, 'from-agent', 'noted'),
        }),
      ),
    ).toEqual({ deleted: ['from-agent'], skipped: ['noted'] });
  });

  it('deletes nothing the second time', async () => {
    const { store, service } = await setup();
    const threads = await confirmed(store, 'noted');
    Effect.runSync(service.execute({ worktreeId, writer: device, threads }));
    expect(
      Effect.runSync(service.execute({ worktreeId, writer: device, threads })),
    ).toEqual({
      deleted: [],
      skipped: ['noted'],
    });
  });
});
