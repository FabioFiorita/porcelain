import { Effect } from 'effect';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type {
  AgentReply,
  CommentAnchor,
  CommentAuthorRole,
  CommentMessage,
  CommentThread,
} from '../../src/models/comment-thread.ts';
import type { CommentStore } from '../../src/ports/comment-store.ts';

export type CommentStoreSubject = {
  store: CommentStore;
  close: () => Promise<void> | void;
};

type Write = { author?: CommentAuthorRole; sizeBytes?: number };

const first = 'a'.repeat(64);
const second = 'b'.repeat(64);
const createdAt = '2026-09-24T10:00:00.000Z';

function message(
  id: string,
  author: CommentAuthorRole = 'reviewer',
): CommentMessage {
  return { id, body: `Body of ${id}`, author, createdAt };
}

async function open(
  store: CommentStore,
  id: string,
  worktreeId = first,
  write: Write = {},
): Promise<CommentThread> {
  const author = write.author ?? 'reviewer';
  return await Effect.runPromise(
    store.insert({
      content: {
        id,
        worktreeId,
        anchor: { kind: 'file', filePath: 'README.md' },
        messages: [message(`${id}-opening`, author)],
      },
      sizeBytes: write.sizeBytes ?? 100,
      writtenByAgent: author === 'agent',
    }),
  );
}

async function reply(
  store: CommentStore,
  thread: CommentThread,
  id: string,
  write: Write = {},
): Promise<CommentThread> {
  const author = write.author ?? 'reviewer';
  return await Effect.runPromise(
    store.append({
      thread,
      message: message(id, author),
      sizeBytes: write.sizeBytes ?? 200,
      writtenByAgent: author === 'agent',
    }),
  );
}

function byThread(replies: readonly AgentReply[]): AgentReply[] {
  return replies.toSorted((left, right) =>
    left.threadId.localeCompare(right.threadId),
  );
}

export function commentStoreContract(
  subject: string,
  openSubject: (
    worktreeIds: readonly string[],
  ) => CommentStoreSubject | Promise<CommentStoreSubject>,
): void {
  describe(subject, () => {
    let opened: CommentStoreSubject;
    let store: CommentStore;

    beforeEach(async () => {
      opened = await openSubject([first, second]);
      store = opened.store;
    });

    afterEach(async () => {
      await opened.close();
    });

    it('opens an inserted thread unresolved at the next revision across every worktree', async () => {
      expect(await open(store, 'one', first)).toMatchObject({
        resolved: false,
        revision: 1,
      });
      expect(await open(store, 'two', second)).toMatchObject({
        resolved: false,
        revision: 2,
      });
      expect(
        await Effect.runPromise(store.find({ threadId: 'two' })),
      ).toMatchObject({
        resolved: false,
        revision: 2,
      });
    });

    it('finds a thread by id with its anchor and messages as inserted', async () => {
      const anchor: CommentAnchor = {
        kind: 'codeRange',
        filePath: 'src/index.ts',
        startLine: 3,
        endLine: 7,
        side: 'additions',
        comparison: { kind: 'commit', parent: 1 },
        revision: 'c'.repeat(40),
        contentFingerprint: 'fingerprint',
      };
      const messages: CommentMessage[] = [
        message('opening'),
        { id: 'undated', body: 'No date', author: 'agent' },
      ];
      const inserted = await Effect.runPromise(
        store.insert({
          content: { id: 'thread', worktreeId: first, anchor, messages },
          sizeBytes: 100,
          writtenByAgent: false,
        }),
      );
      expect(
        await Effect.runPromise(store.find({ threadId: 'thread' })),
      ).toEqual({
        id: 'thread',
        worktreeId: first,
        anchor,
        resolved: false,
        messages,
        revision: 1,
      });
      expect(
        await Effect.runPromise(store.find({ threadId: 'thread' })),
      ).toEqual(inserted);
    });

    it('finds nothing for an unknown thread id', async () => {
      await open(store, 'known');
      expect(
        await Effect.runPromise(store.find({ threadId: 'unknown' })),
      ).toBeUndefined();
    });

    it('lists nothing for a worktree without threads', async () => {
      await open(store, 'elsewhere', second);
      expect(
        await Effect.runPromise(store.list({ worktreeId: first })),
      ).toEqual([]);
    });

    it('lists only the threads of the asked worktree, oldest first', async () => {
      const older = await open(store, 'older', first);
      await open(store, 'elsewhere', second);
      const newer = await open(store, 'newer', first);
      expect(
        await Effect.runPromise(store.list({ worktreeId: first })),
      ).toEqual([older, newer]);
    });

    it('keeps a thread in its place in the list after it is replied to or resolved', async () => {
      const older = await open(store, 'older');
      await open(store, 'newer');
      const replied = await reply(store, older, 'older-reply');
      await Effect.runPromise(
        store.resolve({ thread: replied, resolved: true }),
      );
      expect(
        (await Effect.runPromise(store.list({ worktreeId: first }))).map(
          (thread) => thread.id,
        ),
      ).toEqual(['older', 'newer']);
    });

    it('finds a posted message with its thread and worktree', async () => {
      await open(store, 'thread', second);
      expect(
        await Effect.runPromise(
          store.findMessage({ messageId: 'thread-opening' }),
        ),
      ).toEqual({
        ...message('thread-opening'),
        threadId: 'thread',
        worktreeId: second,
      });
    });

    it('finds a reply by id once it is appended', async () => {
      const thread = await open(store, 'thread');
      await reply(store, thread, 'answer', { author: 'agent' });
      expect(
        await Effect.runPromise(store.findMessage({ messageId: 'answer' })),
      ).toEqual({
        ...message('answer', 'agent'),
        threadId: 'thread',
        worktreeId: first,
      });
    });

    it('finds nothing for an unknown message id', async () => {
      await open(store, 'thread');
      expect(
        await Effect.runPromise(store.findMessage({ messageId: 'unknown' })),
      ).toBeUndefined();
    });

    it('moves a thread to the next revision with the reply last when a reply is appended', async () => {
      const thread = await open(store, 'thread');
      await open(store, 'elsewhere', second);
      const replied = await reply(store, thread, 'answer');
      expect(replied).toEqual({
        ...thread,
        messages: [...thread.messages, message('answer')],
        revision: 3,
      });
      expect(
        await Effect.runPromise(store.find({ threadId: 'thread' })),
      ).toEqual(replied);
    });

    it('keeps replies appended through an older copy of the thread', async () => {
      const thread = await open(store, 'thread');
      await reply(store, thread, 'first-reply');
      await reply(store, thread, 'second-reply');
      expect(
        (
          await Effect.runPromise(store.find({ threadId: 'thread' }))
        )?.messages.map((entry) => entry.id),
      ).toEqual(['thread-opening', 'first-reply', 'second-reply']);
    });

    it('resolves and reopens a thread, each at the next revision', async () => {
      const thread = await open(store, 'thread');
      const resolved = await Effect.runPromise(
        store.resolve({ thread, resolved: true }),
      );
      expect(resolved).toEqual({ ...thread, resolved: true, revision: 2 });
      expect(
        await Effect.runPromise(store.find({ threadId: 'thread' })),
      ).toEqual(resolved);
      const reopened = await Effect.runPromise(
        store.resolve({ thread: resolved, resolved: false }),
      );
      expect(reopened).toEqual({ ...thread, resolved: false, revision: 3 });
      expect(
        await Effect.runPromise(store.find({ threadId: 'thread' })),
      ).toEqual(reopened);
    });

    it('keeps every reply when a thread is resolved through an older copy', async () => {
      const thread = await open(store, 'thread');
      await reply(store, thread, 'answer');
      await Effect.runPromise(store.resolve({ thread, resolved: true }));
      expect(
        await Effect.runPromise(store.find({ threadId: 'thread' })),
      ).toMatchObject({
        resolved: true,
        revision: 3,
        messages: [message('thread-opening'), message('answer')],
      });
    });

    it('counts no threads and no bytes for a worktree without threads', async () => {
      await open(store, 'elsewhere', second);
      expect(
        await Effect.runPromise(store.usage({ worktreeId: first })),
      ).toEqual({
        threads: 0,
        bytes: 0,
      });
    });

    it('sums the stored size of every thread of the worktree', async () => {
      await open(store, 'small', first, { sizeBytes: 100 });
      await open(store, 'large', first, { sizeBytes: 250 });
      await open(store, 'elsewhere', second, { sizeBytes: 999 });
      expect(
        await Effect.runPromise(store.usage({ worktreeId: first })),
      ).toEqual({
        threads: 2,
        bytes: 350,
      });
    });

    it('replaces the stored size of a thread with the size given for its reply', async () => {
      const thread = await open(store, 'thread', first, { sizeBytes: 100 });
      await open(store, 'other', first, { sizeBytes: 50 });
      await reply(store, thread, 'answer', { sizeBytes: 180 });
      expect(
        await Effect.runPromise(store.usage({ worktreeId: first })),
      ).toEqual({
        threads: 2,
        bytes: 230,
      });
    });

    it('keeps the stored size of a thread when it is resolved', async () => {
      const thread = await open(store, 'thread', first, { sizeBytes: 120 });
      await Effect.runPromise(store.resolve({ thread, resolved: true }));
      expect(
        await Effect.runPromise(store.usage({ worktreeId: first })),
      ).toEqual({
        threads: 1,
        bytes: 120,
      });
    });

    it('answers revision zero for a worktree without threads', async () => {
      await open(store, 'elsewhere', second);
      expect(
        await Effect.runPromise(store.lastRevision({ worktreeId: first })),
      ).toBe(0);
    });

    it('answers the latest revision written in the worktree, not the latest written elsewhere', async () => {
      const thread = await open(store, 'thread', first);
      await open(store, 'elsewhere', second);
      expect(
        await Effect.runPromise(store.lastRevision({ worktreeId: first })),
      ).toBe(1);
      await reply(store, thread, 'answer');
      await open(store, 'later', second);
      expect(
        await Effect.runPromise(store.lastRevision({ worktreeId: first })),
      ).toBe(3);
      expect(
        await Effect.runPromise(store.lastRevision({ worktreeId: second })),
      ).toBe(4);
    });

    it('reports no agent replies when no worktree is asked', async () => {
      await open(store, 'thread', first, { author: 'agent' });
      expect(
        await Effect.runPromise(store.listAgentReplies({ worktreeIds: [] })),
      ).toEqual([]);
    });

    it('reports the revision of the agent write of each thread in the asked worktrees only', async () => {
      await open(store, 'agent-opened', first, { author: 'agent' });
      const asked = await open(store, 'agent-answered', first);
      await open(store, 'unanswered', first);
      await reply(store, asked, 'answer', { author: 'agent' });
      await open(store, 'elsewhere', second, { author: 'agent' });
      expect(
        byThread(
          await Effect.runPromise(
            store.listAgentReplies({ worktreeIds: [first] }),
          ),
        ),
      ).toEqual([
        {
          worktreeId: first,
          threadId: 'agent-answered',
          revision: 4,
          resolved: false,
        },
        {
          worktreeId: first,
          threadId: 'agent-opened',
          revision: 1,
          resolved: false,
        },
      ]);
      expect(
        byThread(
          await Effect.runPromise(
            store.listAgentReplies({ worktreeIds: [first, second] }),
          ),
        ).map((entry) => entry.threadId),
      ).toEqual(['agent-answered', 'agent-opened', 'elsewhere']);
    });

    it('stops reporting an agent reply once a reviewer replies after it', async () => {
      const thread = await open(store, 'thread', first, { author: 'agent' });
      await reply(store, thread, 'follow-up', { author: 'reviewer' });
      expect(
        await Effect.runPromise(
          store.listAgentReplies({ worktreeIds: [first] }),
        ),
      ).toEqual([]);
    });

    it('keeps reporting an agent reply at its own revision after the thread is resolved, marked resolved', async () => {
      const thread = await open(store, 'thread');
      const answered = await reply(store, thread, 'answer', {
        author: 'agent',
      });
      await Effect.runPromise(
        store.resolve({ thread: answered, resolved: true }),
      );
      expect(
        await Effect.runPromise(
          store.listAgentReplies({ worktreeIds: [first] }),
        ),
      ).toEqual([
        { worktreeId: first, threadId: 'thread', revision: 2, resolved: true },
      ]);
    });

    it('rewrites one message with its edit time at the next revision and the size given', async () => {
      const thread = await reply(store, await open(store, 'thread'), 'answer');
      await open(store, 'other', first, { sizeBytes: 50 });
      const edited = await Effect.runPromise(
        store.edit({
          thread,
          messageId: 'thread-opening',
          body: 'Rewritten',
          editedAt: '2026-09-25T10:00:00.000Z',
          sizeBytes: 90,
        }),
      );
      expect(edited).toEqual({
        ...thread,
        messages: [
          {
            ...message('thread-opening'),
            body: 'Rewritten',
            editedAt: '2026-09-25T10:00:00.000Z',
          },
          message('answer'),
        ],
        revision: 4,
      });
      expect(
        await Effect.runPromise(store.find({ threadId: 'thread' })),
      ).toEqual(edited);
      expect(
        await Effect.runPromise(
          store.findMessage({ messageId: 'thread-opening' }),
        ),
      ).toMatchObject({
        body: 'Rewritten',
        editedAt: '2026-09-25T10:00:00.000Z',
      });
      expect(
        await Effect.runPromise(store.usage({ worktreeId: first })),
      ).toEqual({
        threads: 2,
        bytes: 140,
      });
    });

    it('removes one message and keeps the rest of the thread at the next revision', async () => {
      const thread = await reply(store, await open(store, 'thread'), 'answer');
      const kept = await Effect.runPromise(
        store.removeMessage({
          thread,
          messageId: 'thread-opening',
          sizeBytes: 60,
        }),
      );
      expect(kept).toEqual({
        ...thread,
        messages: [message('answer')],
        revision: 3,
      });
      expect(
        await Effect.runPromise(store.find({ threadId: 'thread' })),
      ).toEqual(kept);
      expect(
        await Effect.runPromise(
          store.findMessage({ messageId: 'thread-opening' }),
        ),
      ).toBeUndefined();
      expect(
        await Effect.runPromise(store.usage({ worktreeId: first })),
      ).toEqual({
        threads: 1,
        bytes: 60,
      });
    });

    it('removes a thread with its messages', async () => {
      const thread = await reply(store, await open(store, 'thread'), 'answer');
      const other = await open(store, 'other');
      await Effect.runPromise(store.remove({ threadId: thread.id }));
      expect(
        await Effect.runPromise(store.find({ threadId: 'thread' })),
      ).toBeUndefined();
      expect(
        await Effect.runPromise(store.findMessage({ messageId: 'answer' })),
      ).toBeUndefined();
      expect(
        await Effect.runPromise(store.list({ worktreeId: first })),
      ).toEqual([other]);
      expect(
        await Effect.runPromise(store.usage({ worktreeId: first })),
      ).toEqual({
        threads: 1,
        bytes: 100,
      });
    });

    it.each(['inserted', 'found', 'listed'])(
      'hands out a copy of the %s thread, so changing it leaves the stored one unchanged',
      async (source) => {
        const inserted = await open(store, 'thread');
        const thread =
          source === 'inserted'
            ? inserted
            : source === 'found'
              ? await Effect.runPromise(store.find({ threadId: 'thread' }))
              : (await Effect.runPromise(store.list({ worktreeId: first }))).at(
                  0,
                );
        expect(thread).toBeDefined();
        if (!thread) throw new Error('The inserted thread must be available');
        Array.prototype.push.call(thread.messages, message('intruder'));
        expect(
          (
            await Effect.runPromise(store.find({ threadId: 'thread' }))
          )?.messages.map((entry) => entry.id),
        ).toEqual(['thread-opening']);
      },
    );
  });
}
