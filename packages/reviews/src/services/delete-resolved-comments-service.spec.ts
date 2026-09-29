import { describe, expect, it } from 'vitest';
import type {
  CommentAuthor,
  DeleteResolvedCommentsInput,
} from '@porcelain/reviews/models';
import { InMemoryCommentStore } from '../../spec/fakes/in-memory-comment-store.ts';
import { DeleteResolvedCommentsService } from './delete-resolved-comments-service.ts';

const worktreeId = 'a'.repeat(64);
const otherWorktreeId = 'b'.repeat(64);

function thread(
  store: InMemoryCommentStore,
  id: string,
  authors: readonly CommentAuthor[],
  options: { resolved: boolean; worktreeId?: string },
) {
  const opened = store.insert({
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
  });
  if (options.resolved) store.resolve({ thread: opened, resolved: true });
}

function setup() {
  const store = new InMemoryCommentStore();
  thread(store, 'answered', ['reviewer', 'agent'], { resolved: true });
  thread(store, 'noted', ['reviewer'], { resolved: true });
  thread(store, 'open', ['reviewer', 'agent'], { resolved: false });
  thread(store, 'from-agent', ['agent', 'reviewer'], { resolved: true });
  thread(store, 'elsewhere', ['reviewer'], {
    resolved: true,
    worktreeId: otherWorktreeId,
  });
  return { store, service: new DeleteResolvedCommentsService(store) };
}

const ids = (store: InMemoryCommentStore, id = worktreeId) =>
  store.list({ worktreeId: id }).map((entry) => entry.id);
const device: DeleteResolvedCommentsInput['writer'] = { kind: 'device' };

describe('DeleteResolvedCommentsService', () => {
  it('deletes every resolved thread the reviewer started, the agent replies in it included', () => {
    const { store, service } = setup();
    const result = service.execute({ worktreeId, writer: device });
    expect(result.deleted.toSorted()).toEqual(['answered', 'noted']);
    expect(ids(store)).toEqual(['open', 'from-agent']);
    expect(store.findMessage({ messageId: 'answered-1' })).toBeUndefined();
  });

  it('keeps the resolved threads the agent started and counts them', () => {
    const { store, service } = setup();
    expect(service.execute({ worktreeId, writer: device }).kept).toBe(1);
    expect(store.find({ threadId: 'from-agent' })?.messages).toHaveLength(2);
  });

  it('writes as the reviewer for the owner as for a paired device', () => {
    const { store, service } = setup();
    service.execute({ worktreeId, writer: { kind: 'owner' } });
    expect(ids(store)).toEqual(['open', 'from-agent']);
  });

  it("deletes only the agent's resolved threads when the agent asks", () => {
    const { store, service } = setup();
    const result = service.execute({ worktreeId, writer: { kind: 'agent' } });
    expect(result).toEqual({ deleted: ['from-agent'], kept: 2 });
    expect(ids(store)).toEqual(['answered', 'noted', 'open']);
  });

  it('leaves the threads of other worktrees alone', () => {
    const { store, service } = setup();
    service.execute({ worktreeId, writer: device });
    expect(ids(store, otherWorktreeId)).toEqual(['elsewhere']);
  });

  it('deletes nothing when nothing is resolved, and nothing the second time', () => {
    const { store, service } = setup();
    service.execute({ worktreeId, writer: device });
    expect(service.execute({ worktreeId, writer: device })).toEqual({
      deleted: [],
      kept: 1,
    });
    expect(
      service.execute({ worktreeId: 'c'.repeat(64), writer: device }),
    ).toEqual({ deleted: [], kept: 0 });
    expect(ids(store)).toEqual(['open', 'from-agent']);
  });
});
