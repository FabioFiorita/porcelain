import { Atom } from 'effect/reactivity';
import type {
  RuntimeConnection,
  WorktreeScope,
} from '../../../shared/api/connection.ts';
import { worktreeResource } from '../../../shared/api/worktree-read.ts';
import { CommentThreadsState, commentsRuntime } from '../store/comments.ts';

export const readCommentThreads = Atom.family(
  (input: { connection: RuntimeConnection; scope: WorktreeScope }) =>
    worktreeResource(input.scope, CommentThreadsState, commentsRuntime(input)),
);
