import type {
  ListCommentThreadsInput,
  ListCommentThreadsResult,
} from '../models/comment-operations.ts';
import type { CommentThread } from '../models/comment-thread.ts';
import type { CommentStore } from '../ports/comment-store.ts';

function waitsForAgent(thread: CommentThread): boolean {
  return !thread.resolved && thread.messages.at(-1)?.author !== 'agent';
}

export class ListCommentThreadsService {
  private readonly commentStore: CommentStore;

  constructor(commentStore: CommentStore) {
    this.commentStore = commentStore;
  }

  execute(input: ListCommentThreadsInput): ListCommentThreadsResult {
    const threads = this.commentStore.list(input.worktreeId);
    return input.scope === 'waiting' ? threads.filter(waitsForAgent) : threads;
  }
}
