import type {
  ListCommentThreadsInput,
  ListCommentThreadsResult,
} from '../models/comment-operations.ts';
import type { CommentStore } from '../ports/comment-store.ts';

export class ListCommentThreadsService {
  private readonly commentStore: CommentStore;

  constructor(commentStore: CommentStore) {
    this.commentStore = commentStore;
  }

  execute(input: ListCommentThreadsInput): ListCommentThreadsResult {
    return this.commentStore.list(input.worktreeId);
  }
}
