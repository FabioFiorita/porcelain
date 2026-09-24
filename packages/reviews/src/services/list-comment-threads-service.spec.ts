import { describe, expect, it } from 'vitest';
import type { CommentAuthor } from '@porcelain/reviews/models';
import { InMemoryCommentStore } from '../../spec/fakes/in-memory-comment-store.ts';
import { ListCommentThreadsService } from './list-comment-threads-service.ts';

const worktreeId = 'a'.repeat(64);

function open(
  store: InMemoryCommentStore,
  id: string,
  authors: readonly CommentAuthor[],
  owner = worktreeId,
) {
  return store.insert({
    content: {
      id,
      worktreeId: owner,
      anchor: { kind: 'file', filePath: 'README.md' },
      messages: authors.map((author, index) => ({
        id: `${id}-message-${index}`,
        body: 'Message',
        author,
      })),
    },
    sizeBytes: 100,
    writtenByAgent: false,
  });
}

function setup() {
  const store = new InMemoryCommentStore();
  open(store, 'asked', ['reviewer']);
  open(store, 'answered', ['reviewer', 'agent']);
  open(store, 'followed-up', ['reviewer', 'agent', 'reviewer']);
  const done = open(store, 'done', ['reviewer']);
  store.resolve({ thread: done, resolved: true });
  open(store, 'elsewhere', ['reviewer'], 'b'.repeat(64));
  return new ListCommentThreadsService(store);
}

const ids = (threads: readonly { id: string }[]) =>
  threads.map((thread) => thread.id);

describe('ListCommentThreadsService', () => {
  it('lists every thread of the worktree when no scope or the all scope is asked', () => {
    const service = setup();
    const every = ['asked', 'answered', 'followed-up', 'done'];
    expect(ids(service.execute({ worktreeId }))).toEqual(every);
    expect(ids(service.execute({ worktreeId, scope: 'all' }))).toEqual(every);
  });

  it('lists only open threads whose latest message is not from the agent when waiting is asked', () => {
    expect(ids(setup().execute({ worktreeId, scope: 'waiting' }))).toEqual([
      'asked',
      'followed-up',
    ]);
  });
});
