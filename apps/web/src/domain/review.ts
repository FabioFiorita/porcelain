import type {
  ChangeDiffsRequest as ChangeDiffsRequestContract,
  ChangeDiffsResponse,
  ChangeLinesResponse,
  ChangesResponse,
  FileChange as FileChangeResponse,
} from '@porcelain/contracts/changes';
import type {
  CommitDiffsResponse,
  CommitFilesResponse,
} from '@porcelain/contracts/commit-changes';
import type { CommitPageResponse } from '@porcelain/contracts/commit-history';
import type {
  DirectoryResponse,
  PreviewAssetsResponse,
  TextResponse,
} from '@porcelain/contracts/files';
import type { GitStatusResponse } from '@porcelain/contracts/git-status';
import type { ReviewResponse as PublishedReview } from '@porcelain/contracts/review';
import type {
  ReviewedMark as ReviewedMarkResponse,
  ReviewedMarksResponse as ReviewedMarksResponseContract,
  SetReviewedBulkRequest as SetReviewedBulkRequestContract,
  SetReviewedBulkResponse as SetReviewedBulkResponseContract,
  SetReviewedRequest as SetReviewedRequestContract,
} from '@porcelain/contracts/reviewed-files';

export type Directory = DirectoryResponse;
export type PreviewAssets = PreviewAssetsResponse;
export type History = CommitPageResponse;
export type Status = GitStatusResponse;
export type ChangeList = ChangesResponse;
export type FileChange = FileChangeResponse;
export type Change = FileChange['comparisons'][number];
export type ChangeDiffs = ChangeDiffsResponse;
export type ChangeDiffsRequest = ChangeDiffsRequestContract;
export type ChangeLines = ChangeLinesResponse;
export type DiffContent = ChangeDiffs['diffs'][number]['content'];
export type ChangeSelection = ChangeDiffs['diffs'][number]['selection'];
/** What the caller holds for a path, and what the server re-establishes. */
export type ExpectedFile = ChangeDiffsRequest['expectedFiles'][number];
export type ReviewedMark = ReviewedMarkResponse;
export type ReviewedMarksResponse = ReviewedMarksResponseContract;
export type SetReviewedRequest = SetReviewedRequestContract;
export type SetReviewedBulkRequest = SetReviewedBulkRequestContract;
export type SetReviewedBulkResponse = SetReviewedBulkResponseContract;
export type ReviewStatus = 'unreviewed' | 'reviewed' | 'stale';
export type ReviewChangeItem = FileChange & {
  environmentId: string;
  worktreeId: string;
  statusToken: string;
  reviewStatus: ReviewStatus;
  mark?: ReviewedMark;
};
export type ReviewScope = { projectId: string; worktreeId: string };
const SURFACES = ['changes', 'files', 'history'] as const;
export type Surface = (typeof SURFACES)[number];
export function isSurface(value: unknown): value is Surface {
  return SURFACES.some((surface) => surface === value);
}
export function changePath(change: Change) {
  return 'path' in change
    ? change.path
    : (change.newPath ?? change.oldPath ?? '');
}
export function orderReviewChanges<T extends { path: string }>(
  changes: readonly T[],
  files: readonly { path: string }[],
): T[] {
  const remaining = new Map(changes.map((entry) => [entry.path, entry]));
  const ordered: T[] = [];
  for (const file of files) {
    const entry = remaining.get(file.path);
    if (!entry) continue;
    ordered.push(entry);
    remaining.delete(file.path);
  }
  return [...ordered, ...remaining.values()];
}

export function reviewStatus(
  change: Pick<FileChange, 'path' | 'fingerprint'>,
  marks: readonly ReviewedMark[],
): ReviewStatus {
  if (change.fingerprint == null) return 'unreviewed';
  const mark = marks.find((candidate) => candidate.path === change.path);
  if (!mark) return 'unreviewed';
  return mark.fingerprint === change.fingerprint ? 'reviewed' : 'stale';
}

export function reviewMark(
  change: Pick<FileChange, 'path'>,
  marks: readonly ReviewedMark[],
) {
  return marks.find((candidate) => candidate.path === change.path);
}

export function reviewProgress(
  paths: readonly string[],
  changes: readonly Pick<ReviewChangeItem, 'path' | 'reviewStatus'>[],
) {
  const uniquePaths = new Set(paths.filter(Boolean));
  const reviewedPaths = new Set(
    changes
      .filter((entry) => entry.reviewStatus === 'reviewed')
      .map((entry) => entry.path),
  );
  let done = 0;
  for (const path of uniquePaths) {
    if (reviewedPaths.has(path)) done += 1;
  }
  return { done, total: uniquePaths.size };
}

export function isFingerprintable<T extends { fingerprint: string | null }>(
  change: T,
): change is T & { fingerprint: string } {
  return change.fingerprint != null;
}

/**
 * The comparisons of every changed path, flattened. Views that ask "what is
 * changed in this worktree" want this; the review surface wants the grouping.
 */
export function comparisons(list: ChangeList): Change[] {
  return list.changes.flatMap((entry) => entry.comparisons);
}

export function basename(path: string) {
  return path.split('/').at(-1) ?? path;
}

export function shortOid(oid: string) {
  return oid.slice(0, 7);
}

export type TextFile = TextResponse;
export type CommitFiles = CommitFilesResponse;
export type CommitFile = CommitFilesResponse['files'][number];
export type CommitDiffs = CommitDiffsResponse;

export type {
  FileEdit,
  FileEditResult,
  WorktreePaths,
} from '@porcelain/contracts/files';

export type {
  Diagram,
  DiagramBox,
  ReviewLayer,
  ReviewResponse,
  ReviewStep,
} from '@porcelain/contracts/review';

type NotExplained = PublishedReview['notExplained'][number];

/** "12 lines in 3 files", "1 binary file", or both. Null when nothing is left out. */
export function notExplainedLabel(
  entries: readonly NotExplained[],
): string | null {
  const count = (total: number, noun: string) =>
    `${total} ${noun}${total === 1 ? '' : 's'}`;
  const text = entries.filter((entry) => entry.binary !== true);
  const binary = entries.length - text.length;
  const lineCount = text.reduce(
    (total, entry) =>
      total +
      entry.ranges.reduce(
        (sum, range) => sum + range.endLine - range.startLine + 1,
        0,
      ),
    0,
  );
  const parts = [
    ...(text.length > 0
      ? [`${count(lineCount, 'line')} in ${count(text.length, 'file')}`]
      : []),
    ...(binary > 0 ? [count(binary, 'binary file')] : []),
  ];
  return parts.length === 0 ? null : parts.join(' and ');
}
