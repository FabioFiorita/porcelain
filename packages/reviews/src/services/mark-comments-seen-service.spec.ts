import { describe, expect, it } from 'vitest';
import { InMemoryCommentSeenStore } from '../../spec/fakes/in-memory-comment-seen-store.ts';
import { InMemoryCommentStore } from '../../spec/fakes/in-memory-comment-store.ts';
import { MarkCommentsSeenService } from './mark-comments-seen-service.ts';

const worktreeId = 'a'.repeat(64);

function setup() {
  const comments = new InMemoryCommentStore();
  const threads: [string, string][] = [
    ['first', worktreeId],
    ['second', worktreeId],
    ['elsewhere', 'b'.repeat(64)],
  ];
  for (const [id, owner] of threads)
    comments.insert({
      content: {
        id,
        worktreeId: owner,
        anchor: { kind: 'file', filePath: 'README.md' },
        messages: [{ id: `${id}-message`, body: 'Why?', author: 'reviewer' }],
      },
      sizeBytes: 100,
      writtenByAgent: false,
    });
  const seen = new InMemoryCommentSeenStore();
  return { seen, service: new MarkCommentsSeenService(seen, comments) };
}

describe('MarkCommentsSeenService', () => {
  it('records the revision the reader saw', () => {
    const { service, seen } = setup();
    expect(service.execute({ worktreeId, throughRevision: 1 })).toEqual({
      worktreeId,
      seenThrough: 1,
      changed: true,
    });
    expect(seen.seenThrough({ worktreeId })).toBe(1);
  });

  it('never marks past the latest revision of the worktree', () => {
    const { service } = setup();
    expect(
      service.execute({ worktreeId, throughRevision: 99 }).seenThrough,
    ).toBe(2);
  });

  it('reports no change when the reader has already seen that far', () => {
    const { service } = setup();
    service.execute({ worktreeId, throughRevision: 2 });
    expect(service.execute({ worktreeId, throughRevision: 2 }).changed).toBe(
      false,
    );
  });

  it('never moves the mark backwards', () => {
    const { service, seen } = setup();
    service.execute({ worktreeId, throughRevision: 2 });
    expect(
      service.execute({ worktreeId, throughRevision: 1 }).seenThrough,
    ).toBe(2);
    expect(seen.seenThrough({ worktreeId })).toBe(2);
  });
});
