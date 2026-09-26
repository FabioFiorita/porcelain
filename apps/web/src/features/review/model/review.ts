import type {
  ReadChangeDiffsRequest,
  ReadChangeDiffsResponse,
  ReadChangeLinesResponse,
  ReadChangesResponse,
  ReadGitStatusResponse,
} from '@porcelain/contracts/changes';
import type {
  EditFileRequest,
  EditFileResponse,
  ListDirectoryResponse,
  ListWorktreePathsResponse,
  ReadPreviewAssetsResponse,
  ReadTextFileResponse,
} from '@porcelain/contracts/files';
import type {
  ListReviewedFilesResponse,
  ReadPublishedReviewResponse,
  SetReviewedFileRequest,
  SetReviewedFilesRequest,
  SetReviewedFilesResponse,
} from '@porcelain/contracts/reviews';

export type Directory = ListDirectoryResponse;
export type PreviewAssets = ReadPreviewAssetsResponse;
export type Status = ReadGitStatusResponse;
export type ChangeList = ReadChangesResponse;
export type FileChange = ChangeList['changes'][number];
export type Change = FileChange['comparisons'][number];
export type ChangeDiffs = ReadChangeDiffsResponse;
export type ChangeDiffsRequest = ReadChangeDiffsRequest;
export type ChangeLines = ReadChangeLinesResponse;
export type DiffContent = ChangeDiffs['diffs'][number]['content'];
export type ChangeSelection = ChangeDiffs['diffs'][number]['selection'];
export type ReviewedMark = ListReviewedFilesResponse['marks'][number];
export type ReviewedMarksResponse = ListReviewedFilesResponse;
export type SetReviewedRequest = SetReviewedFileRequest;
export type SetReviewedBulkRequest = SetReviewedFilesRequest;
export type SetReviewedBulkResponse = SetReviewedFilesResponse;
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

export function isFingerprintable<
  T extends { fingerprint: string | null | undefined },
>(change: T): change is T & { fingerprint: string } {
  return change.fingerprint != null;
}

export function comparisons(list: ChangeList): Change[] {
  return list.changes.flatMap((entry) => entry.comparisons);
}

export function basename(path: string) {
  return path.split('/').at(-1) ?? path;
}

export type TextFile = ReadTextFileResponse;
export type FileEdit = EditFileRequest;
export type FileEditResult = EditFileResponse;
export type WorktreePaths = ListWorktreePathsResponse;
export type ReviewResponse = NonNullable<ReadPublishedReviewResponse['review']>;
export type Diagram = NonNullable<ReviewResponse['diagram']>['after'];
export type DiagramBox = Diagram['boxes'][number];
export type ReviewLayer = ReviewResponse['layers'][number];
export type ReviewStep = ReviewLayer['steps'][number];

type NotExplained = ReviewResponse['notExplained'][number];

export function reviewSummaryUrl(summary: ReviewResponse['summary']) {
  const query = new URLSearchParams({
    expires: summary.expires,
    signature: summary.signature,
  });
  return `/review-summaries/${encodeURIComponent(summary.token)}?${query}`;
}

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
