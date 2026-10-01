import type {
  ListReviewedLayersResponse,
  SetReviewedLayerRequest,
} from '@porcelain/contracts/reviews';
import type { ProofFile } from './proof';
import {
  isFingerprintable,
  type ReviewChangeItem,
  type ReviewedMarksResponse,
  type ReviewLayer,
  type ReviewResponse,
  type ReviewScope,
  type SetReviewedBulkRequest,
  type SetReviewedBulkResponse,
  type SetReviewedRequest,
} from './review';

type ReviewRequest = ReviewScope & { signal: AbortSignal };
type ReviewedRequest = ReviewRequest & { range: ReviewRange };

export type ReviewRange =
  | { kind: 'worktree' }
  | { kind: 'branch'; base: string; branch: string | undefined };

export const WORKTREE_RANGE: ReviewRange = { kind: 'worktree' };

export function branchReviewRange(
  branch:
    | {
        base?: { ref: string } | undefined;
        head: { branch?: string | undefined };
      }
    | undefined,
): ReviewRange {
  return {
    kind: 'branch',
    base: branch?.base?.ref ?? '',
    branch: branch?.head.branch,
  };
}

export function inChunks<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let at = 0; at < items.length; at += size)
    chunks.push(items.slice(at, at + size));
  return chunks;
}

export type ReviewsPort = {
  review: (request: ReviewRequest) => Promise<ReviewResponse | null>;
  proofFile: (
    request: ReviewRequest & { proofId: string },
  ) => Promise<ProofFile>;
  reviewed: {
    list: (request: ReviewedRequest) => Promise<ReviewedMarksResponse>;
    set: (
      request: ReviewedRequest & { input: MarkReviewedInput },
    ) => Promise<ReviewedMarksResponse>;
    setAll: (
      request: ReviewedRequest & {
        input: Pick<SetReviewedBulkRequest, 'files'>;
      },
    ) => Promise<SetReviewedBulkResponse>;
    remove: (
      request: ReviewedRequest & { path: string },
    ) => Promise<ReviewedMarksResponse>;
    removeAll: (
      request: ReviewedRequest & { paths: readonly string[] },
    ) => Promise<ReviewedMarksResponse>;
  };
  reviewedLayers: {
    list: (request: ReviewRequest) => Promise<ListReviewedLayersResponse>;
    set: (
      request: ReviewRequest & { input: SetReviewedLayerRequest },
    ) => Promise<ListReviewedLayersResponse>;
    remove: (
      request: ReviewRequest & { layerId: string },
    ) => Promise<ListReviewedLayersResponse>;
  };
};

export type MarkReviewedInput = Pick<
  SetReviewedRequest,
  'path' | 'fingerprint'
>;

export type BulkReviewReport = {
  marked: string[];
  skipped: Array<{
    path: string;
    reason: 'not-fingerprintable' | 'already-reviewed';
  }>;
  failed: Array<{ path: string; error: unknown }>;
};

function uniqueByPath<T extends { path: string }>(entries: readonly T[]): T[] {
  return [...new Map(entries.map((entry) => [entry.path, entry])).values()];
}

export type ReviewableItem = Pick<
  ReviewChangeItem,
  'path' | 'fingerprint' | 'reviewStatus'
>;

export function reviewedScopeKey(range: ReviewRange): string[] {
  return range.kind === 'branch'
    ? ['reviewed', 'branch', range.branch ?? '']
    : ['reviewed'];
}

export function bulkMarkPlan(entries: readonly ReviewableItem[]) {
  const report: BulkReviewReport = { marked: [], skipped: [], failed: [] };
  const files: { path: string; fingerprint: string }[] = [];
  for (const entry of uniqueByPath(entries)) {
    if (entry.reviewStatus === 'reviewed') {
      report.skipped.push({ path: entry.path, reason: 'already-reviewed' });
      continue;
    }
    if (!isFingerprintable(entry) || entry.fingerprint == null) {
      report.skipped.push({ path: entry.path, reason: 'not-fingerprintable' });
      continue;
    }
    files.push({ path: entry.path, fingerprint: entry.fingerprint });
  }
  return { report, files };
}

export function bulkMarkReport(
  report: BulkReviewReport,
  response: SetReviewedBulkResponse,
): BulkReviewReport {
  return {
    ...report,
    marked: [...report.marked, ...response.marked],
    failed: [
      ...report.failed,
      ...response.conflicts.map((conflict) => ({
        path: conflict.path,
        error: new Error(
          conflict.reason === 'missing'
            ? 'That file is no longer in the change list.'
            : 'The file changed since it was shown.',
        ),
      })),
    ],
  };
}

export function visibleBulkReport(
  bulk: { report: BulkReviewReport | undefined; submittedAt: number },
  unmarkSubmittedAt: number,
): BulkReviewReport | null {
  return bulk.submittedAt >= unmarkSubmittedAt ? (bulk.report ?? null) : null;
}

export function bulkReportText(report: BulkReviewReport) {
  const failed = report.failed.length;
  const skipped = report.skipped.length;
  return [
    report.marked.length > 0
      ? `Marked ${report.marked.length} ${report.marked.length === 1 ? 'file' : 'files'}.`
      : 'No files marked.',
    skipped > 0 ? `Skipped ${skipped}.` : '',
    failed > 0 ? `${failed} failed.` : '',
  ]
    .filter(Boolean)
    .join(' ');
}

export function markAllPlan(
  entries: readonly ReviewableItem[],
  kind: 'all' | 'layer',
) {
  const unique = uniqueByPath(entries);
  const fingerprintable = unique.filter(isFingerprintable);
  const eligible = fingerprintable.filter(
    (entry) => entry.fingerprint != null && entry.reviewStatus !== 'reviewed',
  );
  const reviewed = fingerprintable.filter(
    (entry) => entry.reviewStatus === 'reviewed',
  );
  const unavailable = unique.length - fingerprintable.length;
  const unmarking = eligible.length === 0 && reviewed.length > 0;
  const completeLabel =
    unavailable > 0
      ? `${fingerprintable.length} reviewed · ${unavailable} unavailable`
      : 'All reviewed';
  const noun = kind === 'layer' ? 'layer' : 'all';
  const settled =
    fingerprintable.length === 0
      ? null
      : unmarking
        ? `Unmark ${noun}`
        : eligible.length === 0
          ? completeLabel
          : null;
  return {
    entries: unique,
    reviewedPaths: reviewed.map((entry) => entry.path),
    unmarking,
    blocked:
      fingerprintable.length === 0 ||
      (eligible.length === 0 && reviewed.length === 0),
    label:
      fingerprintable.length === 0
        ? 'No files can be marked reviewed'
        : (settled ??
          (kind === 'layer'
            ? 'Mark layer reviewed'
            : `Mark all ${eligible.length} files reviewed`)),
    text:
      fingerprintable.length === 0
        ? 'No reviewable files'
        : (settled ??
          (kind === 'layer' ? 'Mark layer reviewed' : 'Mark all reviewed')),
  };
}

export function reviewedControlLabel(
  path: string,
  status: 'unreviewed' | 'reviewed' | 'stale',
) {
  return status === 'reviewed'
    ? `Unmark ${path} as unreviewed`
    : status === 'stale'
      ? `Mark changed ${path} as reviewed`
      : `Mark ${path} as reviewed`;
}

export function layerReviewState(
  marks: ListReviewedLayersResponse | undefined,
  layer: Pick<ReviewLayer, 'id' | 'fingerprint'>,
) {
  const mark = marks?.marks.find((candidate) => candidate.layerId === layer.id);
  const reviewed = mark?.fingerprint === layer.fingerprint && !mark.stale;
  return {
    reviewed,
    label: reviewed
      ? 'Reviewed'
      : mark
        ? 'Mark changed layer reviewed'
        : 'Mark layer reviewed',
  };
}

export type ReviewNotice = {
  title: string;
  description: string;
  type: 'error';
};

export type ReviewToggleTarget = {
  path: string;
  reviewed?: boolean | undefined;
  fingerprint?: string | null | undefined;
};

export function reviewToggle(
  target: ReviewToggleTarget | undefined,
  pending: boolean,
):
  | { kind: 'mark'; input: MarkReviewedInput }
  | { kind: 'unmark'; path: string }
  | null {
  if (!target?.fingerprint || pending) return null;
  return target.reviewed
    ? { kind: 'unmark', path: target.path }
    : {
        kind: 'mark',
        input: { path: target.path, fingerprint: target.fingerprint },
      };
}
