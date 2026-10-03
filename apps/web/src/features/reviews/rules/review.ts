import type {
  ReadBranchChangesResponse,
  ReadChangeDiffsResponse,
  ReadChangesResponse,
} from '@porcelain/contracts/changes';
import type {
  ListReviewedFilesResponse,
  ReadPublishedReviewResponse,
  SetReviewedFileRequest,
  SetReviewedFilesRequest,
  SetReviewedFilesResponse,
} from '@porcelain/contracts/reviews';

export type ChangeList = ReadChangesResponse;
type FileChange = ChangeList['changes'][number];
export type Change = FileChange['comparisons'][number];
type ChangeDiffs = ReadChangeDiffsResponse;
export type DiffContent = ChangeDiffs['diffs'][number]['content'];
export type ChangeSelection = ChangeDiffs['diffs'][number]['selection'];
type ReviewedMark = ListReviewedFilesResponse['marks'][number];
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
  if (change.fingerprint == null) return 'unreviewed';
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
  const selected = paths == null ? null : new Set(paths);
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
  const selected = paths == null ? null : new Set(paths);
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
  return error instanceof Error && error.name === 'ConnectionError'
    ? error.message
    : 'This review surface could not be loaded. Try again.';
}

export function isFingerprintable<
  T extends { fingerprint: string | null | undefined },
>(change: T): change is T & { fingerprint: string } {
  return change.fingerprint != null;
}

export function basename(path: string) {
  return path.split('/').at(-1) ?? path;
}

export type ReviewResponse = NonNullable<ReadPublishedReviewResponse['review']>;
export type Diagram = NonNullable<ReviewResponse['diagram']>['after'];
export type DiagramBox = Diagram['boxes'][number];
export type ReviewLayer = ReviewResponse['layers'][number];
export type ReviewStep = ReviewLayer['steps'][number];

type NotExplained = ReviewResponse['notExplained'][number];

export function reviewSummaryUrl(
  summary: ReviewResponse['summary'],
  address: string,
  desktopApp: string | undefined,
) {
  const token = encodeURIComponent(summary.token);
  const signed = {
    expires: summary.expires,
    signature: summary.signature,
  };
  const computer = new URL(address);
  const app = desktopApp === undefined ? undefined : new URL(desktopApp);
  if (
    app !== undefined &&
    (computer.protocol !== app.protocol || computer.host !== app.host)
  )
    return new URL(
      `/remote-review-summaries/${token}?${new URLSearchParams({
        computer: `${computer.protocol}//${computer.host}`,
        ...signed,
      })}`,
      desktopApp,
    ).href;
  return new URL(
    `/review-summaries/${token}?${new URLSearchParams(signed)}`,
    address,
  ).href;
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

export function summaryLayerNumber(message: unknown): number | null {
  if (
    !message ||
    typeof message !== 'object' ||
    !('source' in message) ||
    !('openLayer' in message)
  )
    return null;
  return message.source === 'porcelain-summary' &&
    typeof message.openLayer === 'number' &&
    Number.isInteger(message.openLayer)
    ? message.openLayer
    : null;
}
