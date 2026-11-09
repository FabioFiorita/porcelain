import { Atom } from 'effect/reactivity';
import type {
  RuntimeConnection,
  WorktreeScope,
} from '../../../shared/api/connection.ts';
import {
  retainRead,
  worktreeResource,
} from '../../../shared/api/worktree-read.ts';
import { CommentThreadsState, commentsRuntime } from '../store/comments.ts';

const reads = Atom.family(
  (input: { connection: RuntimeConnection; scope: WorktreeScope }) =>
    worktreeResource(
      input.scope,
      'comments',
      CommentThreadsState,
      commentsRuntime(input),
    ).pipe(retainRead),
);

export function readCommentThreads({
  connection,
  scope,
}: {
  connection: RuntimeConnection;
  scope: WorktreeScope;
}) {
  return reads({ connection, scope });
}
