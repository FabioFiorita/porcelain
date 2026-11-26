import { Effect } from 'effect';
import type { StoredDraftComment } from '../../src/models/draft-comment.ts';
import type { DraftCommentStore } from '../../src/ports/draft-comment-store.ts';

function key(input: { worktreeId: string; id: string }) {
  return JSON.stringify([input.worktreeId, input.id]);
}

export class InMemoryDraftCommentStore implements DraftCommentStore {
  private readonly comments = new Map<string, StoredDraftComment>();
  private readonly edits = new Map<
    string,
    Pick<StoredDraftComment, 'text' | 'updatedAt'>
  >();
  private readonly publications = new Map<
    string,
    StoredDraftComment['publication']
  >();

  private read(comment: StoredDraftComment) {
    return {
      ...comment,
      ...this.edits.get(key(comment)),
      publication: this.publications.get(key(comment)) ?? comment.publication,
    };
  }

  list(input: { worktreeId: string; branch: string }) {
    return Effect.sync(() =>
      [...this.comments.values()]
        .filter(
          (comment) =>
            comment.worktreeId === input.worktreeId &&
            comment.branch === input.branch,
        )
        .map((comment) => this.read(comment)),
    );
  }

  find(input: { worktreeId: string; id: string }) {
    return Effect.sync(
      () =>
        [...this.comments.values()]
          .filter((comment) => key(comment) === key(input))
          .map((comment) => this.read(comment))[0],
    );
  }

  insert(comment: StoredDraftComment) {
    return Effect.sync(() => {
      this.edits.delete(key(comment));
      this.publications.delete(key(comment));
      this.comments.set(key(comment), comment);
    });
  }

  updateText(input: {
    worktreeId: string;
    id: string;
    text: string;
    updatedAt: string;
  }) {
    return Effect.sync(
      () =>
        void this.edits.set(key(input), {
          text: input.text,
          updatedAt: input.updatedAt,
        }),
    );
  }

  remove(input: { worktreeId: string; id: string }) {
    return Effect.sync(() => void this.comments.delete(key(input)));
  }

  markPublished(input: {
    worktreeId: string;
    ids: readonly string[];
    url: string;
    publishedAt: string;
  }) {
    return Effect.sync(() => {
      input.ids.forEach((id) => {
        this.publications.set(key({ worktreeId: input.worktreeId, id }), {
          status: 'published',
          url: input.url,
          publishedAt: input.publishedAt,
        });
      });
    });
  }
}
