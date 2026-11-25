import { Effect } from 'effect';
import type { StoredDraftComment } from '../../src/models/draft-comment.ts';
import type { DraftCommentStore } from '../../src/ports/draft-comment-store.ts';

export class InMemoryDraftCommentStore implements DraftCommentStore {
  readonly comments = new Map<string, StoredDraftComment>();

  list(input: { worktreeId: string; branch: string }) {
    return Effect.succeed(
      [...this.comments.values()].filter(
        (comment) =>
          comment.worktreeId === input.worktreeId &&
          comment.branch === input.branch,
      ),
    );
  }
  find(input: { worktreeId: string; id: string }) {
    const found = this.comments.get(input.id);
    return Effect.succeed(
      found?.worktreeId === input.worktreeId ? found : undefined,
    );
  }
  insert(comment: StoredDraftComment) {
    return Effect.sync(() => void this.comments.set(comment.id, comment));
  }
  updateText(input: {
    worktreeId: string;
    id: string;
    text: string;
    updatedAt: string;
  }) {
    return Effect.sync(() => {
      const found = this.comments.get(input.id);
      if (found?.worktreeId === input.worktreeId)
        this.comments.set(input.id, {
          ...found,
          text: input.text,
          updatedAt: input.updatedAt,
        });
    });
  }
  remove(input: { worktreeId: string; id: string }) {
    return Effect.sync(() => void this.comments.delete(input.id));
  }
  markPublished(input: {
    worktreeId: string;
    ids: readonly string[];
    url: string;
    publishedAt: string;
  }) {
    return Effect.sync(() => {
      for (const id of input.ids) {
        const found = this.comments.get(id);
        if (found?.worktreeId === input.worktreeId)
          this.comments.set(id, {
            ...found,
            publication: {
              status: 'published',
              url: input.url,
              publishedAt: input.publishedAt,
            },
          });
      }
    });
  }
}
