import { Atom } from 'effect/reactivity';
import type {
  RuntimeConnection,
  WorktreeScope,
} from '../../../shared/api/connection.ts';
import { worktreeResource } from '../../../shared/api/worktree-read.ts';
import { ReviewedFilesState, reviewedRuntime } from '../store/reviewed.ts';
import {
  reviewedReadRange,
  type ReviewedReadRange,
  WORKTREE_RANGE,
} from '../rules/reviewed.ts';

const reads = Atom.family(
  (input: {
    connection: RuntimeConnection;
    scope: WorktreeScope;
    range: ReviewedReadRange;
  }) =>
    worktreeResource(input.scope, ReviewedFilesState, reviewedRuntime(input)),
);
export function readReviewedFiles({
  range = WORKTREE_RANGE,
  ...input
}: {
  connection: RuntimeConnection;
  scope: WorktreeScope;
  range?: ReviewedReadRange;
}) {
  return reads({ ...input, range: reviewedReadRange(range) });
}
