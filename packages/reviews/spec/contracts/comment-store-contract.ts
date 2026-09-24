import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type {
  AgentReply,
  CommentAnchor,
  CommentAuthor,
  CommentMessage,
  CommentThread,
} from '../../src/models/comment-thread.ts';
import type { CommentStore } from '../../src/ports/comment-store.ts';

export type CommentStoreSubject = {
  store: CommentStore;
  close: () => void;
};

type Write = { author?: CommentAuthor; sizeBytes?: number };

const first = 'a'.repeat(64);
const second = 'b'.repeat(64);
const createdAt = '2026-09-24T10:00:00.000Z';

function message(
  id: string,
  author: CommentAuthor = 'reviewer',
): CommentMessage {
  return { id, body: `Body of ${id}`, author, createdAt };
}

function open(
  store: CommentStore,
  id: string,
  worktreeId = first,
  write: Write = {},
): CommentThread {
  const author = write.author ?? 'reviewer';
  return store.insert({
    content: {
      id,
      worktreeId,
      anchor: { kind: 'file', filePath: 'README.md' },
      messages: [message(`${id}-opening`, author)],
    },
    sizeBytes: write.sizeBytes ?? 100,
    writtenByAgent: author === 'agent',
  });
}

function reply(
  store: CommentStore,
  thread: CommentThread,
  id: string,
  write: Write = {},
): CommentThread {
  const author = write.author ?? 'reviewer';
  return store.append({
    thread,
    message: message(id, author),
    sizeBytes: write.sizeBytes ?? 200,
    writtenByAgent: author === 'agent',
  });
}

function byThread(replies: readonly AgentReply[]): AgentReply[] {
  return replies.toSorted((left, right) =>
    left.threadId.localeCompare(right.threadId),
  );
}

export function commentStoreContract(
  subject: string,
  openSubject: (worktreeIds: readonly string[]) => CommentStoreSubject,
): void {
  describe(subject, () => {
    let opened: CommentStoreSubject;
    let store: CommentStore;

    beforeEach(() => {
      opened = openSubject([first, second]);
      store = opened.store;
    });

    afterEach(() => {
      opened.close();
    });

    it('opens an inserted thread unresolved at the next revision across every worktree', () => {
      expect(open(store, 'one', first)).toMatchObject({
        resolved: false,
        revision: 1,
      });
      expect(open(store, 'two', second)).toMatchObject({
        resolved: false,
        revision: 2,
      });
      expect(store.find({ threadId: 'two' })).toMatchObject({
        resolved: false,
        revision: 2,
      });
    });

    it('finds a thread by id with its anchor and messages as inserted', () => {
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
      const inserted = store.insert({
        content: { id: 'thread', worktreeId: first, anchor, messages },
        sizeBytes: 100,
        writtenByAgent: false,
      });
      expect(store.find({ threadId: 'thread' })).toEqual({
        id: 'thread',
        worktreeId: first,
        anchor,
        resolved: false,
        messages,
        revision: 1,
      });
      expect(store.find({ threadId: 'thread' })).toEqual(inserted);
    });

    it('finds nothing for an unknown thread id', () => {
      open(store, 'known');
      expect(store.find({ threadId: 'unknown' })).toBeUndefined();
    });

    it('lists nothing for a worktree without threads', () => {
      open(store, 'elsewhere', second);
      expect(store.list({ worktreeId: first })).toEqual([]);
    });

    it('lists only the threads of the asked worktree, oldest first', () => {
      const older = open(store, 'older', first);
      open(store, 'elsewhere', second);
      const newer = open(store, 'newer', first);
      expect(store.list({ worktreeId: first })).toEqual([older, newer]);
    });

    it('keeps a thread in its place in the list after it is replied to or resolved', () => {
      const older = open(store, 'older');
      open(store, 'newer');
      const replied = reply(store, older, 'older-reply');
      store.resolve({ thread: replied, resolved: true });
      expect(
        store.list({ worktreeId: first }).map((thread) => thread.id),
      ).toEqual(['older', 'newer']);
    });

    it('finds a posted message with its thread and worktree', () => {
      open(store, 'thread', second);
      expect(store.findMessage({ messageId: 'thread-opening' })).toEqual({
        ...message('thread-opening'),
        threadId: 'thread',
        worktreeId: second,
      });
    });

    it('finds a reply by id once it is appended', () => {
      const thread = open(store, 'thread');
      reply(store, thread, 'answer', { author: 'agent' });
      expect(store.findMessage({ messageId: 'answer' })).toEqual({
        ...message('answer', 'agent'),
        threadId: 'thread',
        worktreeId: first,
      });
    });

    it('finds nothing for an unknown message id', () => {
      open(store, 'thread');
      expect(store.findMessage({ messageId: 'unknown' })).toBeUndefined();
    });

    it('moves a thread to the next revision with the reply last when a reply is appended', () => {
      const thread = open(store, 'thread');
      open(store, 'elsewhere', second);
      const replied = reply(store, thread, 'answer');
      expect(replied).toEqual({
        ...thread,
        messages: [...thread.messages, message('answer')],
        revision: 3,
      });
      expect(store.find({ threadId: 'thread' })).toEqual(replied);
    });

    it('keeps replies appended through an older copy of the thread', () => {
      const thread = open(store, 'thread');
      reply(store, thread, 'first-reply');
      reply(store, thread, 'second-reply');
      expect(
        store.find({ threadId: 'thread' })?.messages.map((entry) => entry.id),
      ).toEqual(['thread-opening', 'first-reply', 'second-reply']);
    });

    it('resolves and reopens a thread, each at the next revision', () => {
      const thread = open(store, 'thread');
      const resolved = store.resolve({ thread, resolved: true });
      expect(resolved).toEqual({ ...thread, resolved: true, revision: 2 });
      expect(store.find({ threadId: 'thread' })).toEqual(resolved);
      const reopened = store.resolve({ thread: resolved, resolved: false });
      expect(reopened).toEqual({ ...thread, resolved: false, revision: 3 });
      expect(store.find({ threadId: 'thread' })).toEqual(reopened);
    });

    it('keeps every reply when a thread is resolved through an older copy', () => {
      const thread = open(store, 'thread');
      reply(store, thread, 'answer');
      store.resolve({ thread, resolved: true });
      expect(store.find({ threadId: 'thread' })).toMatchObject({
        resolved: true,
        revision: 3,
        messages: [message('thread-opening'), message('answer')],
      });
    });

    it('counts no threads and no bytes for a worktree without threads', () => {
      open(store, 'elsewhere', second);
      expect(store.usage({ worktreeId: first })).toEqual({
        threads: 0,
        bytes: 0,
      });
    });

    it('sums the stored size of every thread of the worktree', () => {
      open(store, 'small', first, { sizeBytes: 100 });
      open(store, 'large', first, { sizeBytes: 250 });
      open(store, 'elsewhere', second, { sizeBytes: 999 });
      expect(store.usage({ worktreeId: first })).toEqual({
        threads: 2,
        bytes: 350,
      });
    });

    it('replaces the stored size of a thread with the size given for its reply', () => {
      const thread = open(store, 'thread', first, { sizeBytes: 100 });
      open(store, 'other', first, { sizeBytes: 50 });
      reply(store, thread, 'answer', { sizeBytes: 180 });
      expect(store.usage({ worktreeId: first })).toEqual({
        threads: 2,
        bytes: 230,
      });
    });

    it('keeps the stored size of a thread when it is resolved', () => {
      const thread = open(store, 'thread', first, { sizeBytes: 120 });
      store.resolve({ thread, resolved: true });
      expect(store.usage({ worktreeId: first })).toEqual({
        threads: 1,
        bytes: 120,
      });
    });

    it('answers revision zero for a worktree without threads', () => {
      open(store, 'elsewhere', second);
      expect(store.lastRevision({ worktreeId: first })).toBe(0);
    });

    it('answers the latest revision written in the worktree, not the latest written elsewhere', () => {
      const thread = open(store, 'thread', first);
      open(store, 'elsewhere', second);
      expect(store.lastRevision({ worktreeId: first })).toBe(1);
      reply(store, thread, 'answer');
      open(store, 'later', second);
      expect(store.lastRevision({ worktreeId: first })).toBe(3);
      expect(store.lastRevision({ worktreeId: second })).toBe(4);
    });

    it('reports no agent replies when no worktree is asked', () => {
      open(store, 'thread', first, { author: 'agent' });
      expect(store.agentRepliesByWorktrees({ worktreeIds: [] })).toEqual([]);
    });

    it('reports the revision of the agent write of each thread in the asked worktrees only', () => {
      open(store, 'agent-opened', first, { author: 'agent' });
      const asked = open(store, 'agent-answered', first);
      open(store, 'unanswered', first);
      reply(store, asked, 'answer', { author: 'agent' });
      open(store, 'elsewhere', second, { author: 'agent' });
      expect(
        byThread(store.agentRepliesByWorktrees({ worktreeIds: [first] })),
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
          store.agentRepliesByWorktrees({ worktreeIds: [first, second] }),
        ).map((entry) => entry.threadId),
      ).toEqual(['agent-answered', 'agent-opened', 'elsewhere']);
    });

    it('stops reporting an agent reply once a reviewer replies after it', () => {
      const thread = open(store, 'thread', first, { author: 'agent' });
      reply(store, thread, 'follow-up', { author: 'reviewer' });
      expect(store.agentRepliesByWorktrees({ worktreeIds: [first] })).toEqual(
        [],
      );
    });

    it('keeps reporting an agent reply at its own revision after the thread is resolved, marked resolved', () => {
      const thread = open(store, 'thread');
      const answered = reply(store, thread, 'answer', { author: 'agent' });
      store.resolve({ thread: answered, resolved: true });
      expect(store.agentRepliesByWorktrees({ worktreeIds: [first] })).toEqual([
        { worktreeId: first, threadId: 'thread', revision: 2, resolved: true },
      ]);
    });

    it('hands out copies, so changing a returned thread leaves the stored one unchanged', () => {
      open(store, 'thread').messages.push(message('intruder'));
      store.find({ threadId: 'thread' })?.messages.push(message('intruder'));
      store
        .list({ worktreeId: first })
        .at(0)
        ?.messages.push(message('intruder'));
      expect(
        store.find({ threadId: 'thread' })?.messages.map((entry) => entry.id),
      ).toEqual(['thread-opening']);
    });
  });
}
