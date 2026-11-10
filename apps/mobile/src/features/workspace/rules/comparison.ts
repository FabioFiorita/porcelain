import type {
  ReadBranchChangesResponse,
  ReadChangesResponse,
} from '@porcelain/contracts/changes';
import {
  branchReviewRange,
  WORKTREE_RANGE,
  type ReviewRange,
} from '@porcelain/client/changes/rules';
import {
  mergeBranchChanges,
  mergeReviewChanges,
  type ReviewStatus,
} from '@porcelain/client/changes/rules';
import {
  branchChangeMarks,
  worktreeChangeMarks,
  type FileChangeMarks,
} from '@porcelain/client/files/rules';
import type { ListReviewedFilesResponse } from '@porcelain/contracts/changes';
import { AsyncResult } from 'effect/reactivity';

export type ReviewSnapshot =
  | { kind: 'worktree'; answer: ReadChangesResponse }
  | { kind: 'branch'; answer: ReadBranchChangesResponse };
export type ReviewFile = {
  path: string;
  fingerprint?: string | null | undefined;
  reviewStatus: ReviewStatus;
  note: string;
};

export function reviewRange(snapshot: ReviewSnapshot): ReviewRange {
  return snapshot.kind === 'branch'
    ? branchReviewRange(snapshot.answer)
    : WORKTREE_RANGE;
}

export function reviewFiles(
  snapshot: ReviewSnapshot,
  marks: ListReviewedFilesResponse,
): ReviewFile[] {
  return snapshot.kind === 'worktree'
    ? mergeReviewChanges(snapshot.answer, marks).map((file) => ({
        ...file,
        note: file.comparisons
          .map((change) =>
            change.scope === 'unmerged'
              ? `Conflict: ${change.conflict}`
              : change.scope,
          )
          .join(' · '),
      }))
    : mergeBranchChanges(snapshot.answer.files, marks).map((file) => ({
        ...file,
        note: file.status,
      }));
}

export function fileReviewLabels<E, F>(
  snapshot: AsyncResult.AsyncResult<ReviewSnapshot, E>,
  marks: AsyncResult.AsyncResult<ListReviewedFilesResponse, F>,
): ReadonlyMap<string, string> {
  if (
    !AsyncResult.isSuccess(snapshot) ||
    snapshot.waiting ||
    !AsyncResult.isSuccess(marks) ||
    marks.waiting
  )
    return new Map();
  return new Map(
    reviewFiles(snapshot.value, marks.value).map((file) => [
      file.path,
      !file.fingerprint
        ? 'Review status unavailable'
        : file.reviewStatus === 'reviewed'
          ? 'Reviewed'
          : file.reviewStatus === 'stale'
            ? 'Changed since review'
            : 'Unreviewed',
    ]),
  );
}

export function snapshotChangeMarks<E>(
  snapshot: AsyncResult.AsyncResult<ReviewSnapshot, E>,
): FileChangeMarks {
  if (!AsyncResult.isSuccess(snapshot))
    return { files: new Map(), folders: new Set() };
  return snapshot.value.kind === 'worktree'
    ? worktreeChangeMarks(snapshot.value.answer.changes)
    : branchChangeMarks(snapshot.value.answer.files);
}
