import { describe, expect, it } from 'vitest';
import type {
  CommentAuthorRole,
  DeleteResolvedCommentsInput,
} from '@porcelain/reviews/models';
import { InMemoryCommentStore } from '../../spec/fakes/in-memory-comment-store.ts';
import { DeleteResolvedCommentsService } from './delete-resolved-comments-service.ts';

const worktreeId = 'a'.repeat(64);
const otherWorktreeId = 'b'.repeat(64);

function thread(
  store: InMemoryCommentStore,
  id: string,
  authors: readonly CommentAuthorRole[],
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
const confirmed = (store: InMemoryCommentStore, ...threadIds: string[]) =>
  threadIds.map((threadId) => ({
    threadId,
    revision: store.find({ threadId })?.revision ?? 0,
  }));

describe('DeleteResolvedCommentsService', () => {
  it('deletes the confirmed resolved threads the reviewer started, the agent replies in them included', () => {
    const { store, service } = setup();
    const result = service.execute({
      worktreeId,
      writer: device,
      threads: confirmed(store, 'answered', 'noted'),
    });
    expect(result).toEqual({ deleted: ['answered', 'noted'], skipped: [] });
    expect(ids(store)).toEqual(['open', 'from-agent']);
    expect(store.findMessage({ messageId: 'answered-1' })).toBeUndefined();
  });

  it('keeps a confirmed thread the agent answered after the reviewer confirmed', () => {
    const { store, service } = setup();
    const threads = confirmed(store, 'answered', 'noted');
    const answered = store.find({ threadId: 'answered' });
    if (answered)
      store.append({
        thread: answered,
        message: { id: 'late', body: 'One more thing', author: 'agent' },
        sizeBytes: 150,
        writtenByAgent: true,
      });
    const result = service.execute({ worktreeId, writer: device, threads });
    expect(result).toEqual({ deleted: ['noted'], skipped: ['answered'] });
    expect(store.findMessage({ messageId: 'late' })?.body).toBe(
      'One more thing',
    );
  });

  it('keeps a confirmed thread that was reopened', () => {
    const { store, service } = setup();
    const threads = confirmed(store, 'noted');
    const noted = store.find({ threadId: 'noted' });
    if (noted) store.resolve({ thread: noted, resolved: false });
    expect(service.execute({ worktreeId, writer: device, threads })).toEqual({
      deleted: [],
      skipped: ['noted'],
    });
    expect(ids(store)).toContain('noted');
  });

  it('keeps an open thread, a thread the agent started and a thread of another worktree even when named', () => {
    const { store, service } = setup();
    const result = service.execute({
      worktreeId,
      writer: device,
      threads: confirmed(store, 'open', 'from-agent', 'elsewhere', 'unknown'),
    });
    expect(result).toEqual({
      deleted: [],
      skipped: ['open', 'from-agent', 'elsewhere', 'unknown'],
    });
    expect(ids(store)).toEqual(['answered', 'noted', 'open', 'from-agent']);
    expect(ids(store, otherWorktreeId)).toEqual(['elsewhere']);
  });

  it('writes as the reviewer for the owner as for a paired device', () => {
    const { store, service } = setup();
    service.execute({
      worktreeId,
      writer: { kind: 'owner' },
      threads: confirmed(store, 'noted'),
    });
    expect(ids(store)).not.toContain('noted');
  });

  it("deletes only the agent's own resolved threads when the agent asks", () => {
    const { store, service } = setup();
    expect(
      service.execute({
        worktreeId,
        writer: { kind: 'agent' },
        threads: confirmed(store, 'from-agent', 'noted'),
      }),
    ).toEqual({ deleted: ['from-agent'], skipped: ['noted'] });
  });

  it('deletes nothing the second time', () => {
    const { store, service } = setup();
    const threads = confirmed(store, 'noted');
    service.execute({ worktreeId, writer: device, threads });
    expect(service.execute({ worktreeId, writer: device, threads })).toEqual({
      deleted: [],
      skipped: ['noted'],
    });
  });
});
