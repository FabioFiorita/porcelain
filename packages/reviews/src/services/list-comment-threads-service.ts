import type {
  ListCommentThreadsInput,
  ListCommentThreadsResult,
} from '../models/list-comment-threads.ts';
import type { CommentStore } from '../ports/comment-store.ts';
import { waitsForAgent } from '../rules/comment-threads.ts';

export class ListCommentThreadsService {
  private readonly comments: CommentStore;

  constructor(comments: CommentStore) {
    this.comments = comments;
  }

  execute(input: ListCommentThreadsInput): ListCommentThreadsResult {
    const threads = this.comments.list({ worktreeId: input.worktreeId });
    return input.scope === 'waiting' ? threads.filter(waitsForAgent) : threads;
  }
}
