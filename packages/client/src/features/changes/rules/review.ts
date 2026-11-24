import type {
  ReadBranchChangesResponse,
  ReadChangeDiffsResponse,
  ReadChangesResponse,
} from '@porcelain/contracts/changes';
import type {
  ListReviewedFilesResponse,
  SetReviewedFileRequest,
  SetReviewedFilesResponse,
} from '@porcelain/contracts/changes';

export type ChangeList = ReadChangesResponse;
type FileChange = ChangeList['changes'][number];
export type Change = FileChange['comparisons'][number];
type ChangeDiffs = ReadChangeDiffsResponse;
export type DiffContent = ChangeDiffs['diffs'][number]['content'];
type ReviewedMark = ListReviewedFilesResponse['marks'][number];
type ReviewedMarksResponse = ListReviewedFilesResponse;
export type SetReviewedRequest = SetReviewedFileRequest;
export type SetReviewedBulkResponse = SetReviewedFilesResponse;
export type ReviewStatus = 'unreviewed' | 'reviewed' | 'stale';
export type ReviewChangeItem = FileChange & {
  environmentId: string;
  worktreeId: string;
  statusToken: string;
  reviewStatus: ReviewStatus;
  mark?: ReviewedMark;
};
export type ReviewScope = {
  projectId: string;
  worktreeId: string;
};
type BranchFile = ReadBranchChangesResponse['files'][number];
export type BranchChangeItem = BranchFile & {
  reviewStatus: ReviewStatus;
  mark?: ReviewedMark;
};
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

function reviewStatus(
  change: Pick<FileChange, 'path' | 'fingerprint'>,
  marks: readonly ReviewedMark[],
): ReviewStatus {
  if (change.fingerprint === null || change.fingerprint === undefined)
    return 'unreviewed';
  const mark = marks.find((candidate) => candidate.path === change.path);
  if (!mark) return 'unreviewed';
  return mark.fingerprint === change.fingerprint ? 'reviewed' : 'stale';
}

function reviewMark(
  change: Pick<FileChange, 'path'>,
  marks: readonly ReviewedMark[],
) {
  return marks.find((candidate) => candidate.path === change.path);
}

export function mergeReviewChanges(
  list: ChangeList,
  reviewed: ReviewedMarksResponse,
  paths?: readonly string[],
): ReviewChangeItem[] {
  const selected =
    paths === null || paths === undefined ? null : new Set(paths);
  return list.changes.flatMap((entry) => {
    if (selected && !selected.has(entry.path)) return [];
    const mark = reviewMark(entry, reviewed.marks);
    return [
      {
        ...entry,
        environmentId: list.environmentId,
        worktreeId: list.worktreeId,
        statusToken: list.statusToken,
        reviewStatus: reviewStatus(entry, reviewed.marks),
        ...(mark ? { mark } : {}),
      },
    ];
  });
}

export function mergeBranchChanges(
  files: readonly BranchFile[],
  reviewed: ReviewedMarksResponse,
  paths?: readonly string[],
): BranchChangeItem[] {
  const selected =
    paths === null || paths === undefined ? null : new Set(paths);
  return files.flatMap((file) => {
    if (selected && !selected.has(file.path)) return [];
    const mark = reviewMark(file, reviewed.marks);
    return [
      {
        ...file,
        reviewStatus: reviewStatus(file, reviewed.marks),
        ...(mark ? { mark } : {}),
      },
    ];
  });
}

export function reviewErrorMessage(error: unknown) {
  return error instanceof Error &&
    (error.name === 'ConnectionError' || error.name === 'WriteNotSentError')
    ? error.message
    : 'These changes could not be loaded. Try again.';
}

export function isFingerprintable<
  T extends { fingerprint: string | null | undefined },
>(change: T): change is T & { fingerprint: string } {
  return change.fingerprint !== null && change.fingerprint !== undefined;
}

export function basename(path: string) {
  return path.split('/').at(-1) ?? path;
}
