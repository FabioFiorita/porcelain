import type {
  ReadBranchChangesResponse,
  ReadChangesResponse,
} from '@porcelain/contracts/changes';
import {
  branchReviewRange,
  mergeBranchChanges,
  mergeReviewChanges,
  WORKTREE_RANGE,
  type CommentTarget,
  type ReviewRange,
  type ReviewStatus,
} from '@porcelain/client/reviews/rules';
import { commitPath } from '@porcelain/client/history/rules';
import {
  branchChangeMarks,
  worktreeChangeMarks,
  type FileChangeMarks,
} from '@porcelain/client/files/rules';
import type { ListReviewedFilesResponse } from '@porcelain/contracts/reviews';
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

export function commentTarget(
  snapshot: ReviewSnapshot,
  file: Pick<ReviewFile, 'path' | 'fingerprint'>,
  scope?: 'staged' | 'unstaged' | 'untracked',
): CommentTarget | undefined {
  if (!file.fingerprint) return undefined;
  if (snapshot.kind === 'branch') {
    if (!snapshot.answer.base) return undefined;
    return {
      filePath: file.path,
      comparison: { kind: 'branch', base: snapshot.answer.base.ref },
      revision: snapshot.answer.head.oid,
      contentFingerprint: file.fingerprint,
    };
  }
  return scope
    ? {
        filePath: file.path,
        comparison: { kind: 'worktree', scope },
        contentFingerprint: file.fingerprint,
      }
    : undefined;
}

export function documentReviewTarget(
  snapshot: ReviewSnapshot | undefined,
  path: string,
  preferredScope: string | undefined,
) {
  if (!snapshot) return undefined;
  if (snapshot.kind === 'branch') {
    const file = snapshot.answer.files.find(
      (entry) => commitPath(entry) === path,
    );
    return file
      ? commentTarget(snapshot, { path, fingerprint: file.fingerprint })
      : undefined;
  }
  const file = snapshot.answer.changes.find((entry) => entry.path === path);
  const comparison =
    file?.comparisons.find((entry) => entry.scope === preferredScope) ??
    file?.comparisons[0];
  if (!file || !comparison || comparison.scope === 'unmerged') return undefined;
  return commentTarget(snapshot, file, comparison.scope);
}
