import type { ExpectedFile } from '@porcelain/kernel/models';
import { expectationHolds } from '@porcelain/kernel/rules';
import type { ReviewLayer } from '../models/review.ts';
import type {
  ReviewedFile,
  ReviewedFileConflict,
  ReviewedFileMark,
  ReviewedFileSelection,
  ListedReviewedLayerMark,
  ReviewedLayerMark,
  ReviewedMark,
} from '../models/reviewed-mark.ts';

export function selectReviewedFiles(
  files: readonly ReviewedFile[],
  changes: readonly ExpectedFile[],
): ReviewedFileSelection {
  const latest = new Map(files.map((file) => [file.path, file.fingerprint]));
  const current = new Map(
    changes.map((change) => [change.path, change.fingerprint]),
  );
  const marked: ReviewedFile[] = [];
  const conflicts: ReviewedFileConflict[] = [];
  for (const [path, fingerprint] of latest) {
    if (!current.has(path)) conflicts.push({ path, reason: 'missing' });
    else if (!expectationHolds([{ path, fingerprint }], current))
      conflicts.push({ path, reason: 'stale' });
    else marked.push({ path, fingerprint });
  }
  return { marked, conflicts };
}

export function evictedPaths(
  existing: readonly ReviewedFileMark[],
  marking: readonly ReviewedFile[],
  limit: number,
  shown: ReadonlySet<string> = new Set(),
): string[] {
  const remarked = new Set(marking.map((file) => file.path));
  const kept = existing.filter((mark) => !remarked.has(mark.path));
  const excess = kept.length + marking.length - limit;
  if (excess <= 0) return [];
  return kept
    .filter((mark) => !shown.has(mark.path))
    .sort(
      (left, right) =>
        Date.parse(left.reviewedAt) - Date.parse(right.reviewedAt) ||
        (left.path < right.path ? -1 : 1),
    )
    .slice(0, excess)
    .map((mark) => mark.path);
}

export function touchedMarks(
  marks: readonly string[],
  paths: readonly string[] | undefined,
): string[] {
  if (paths === undefined) return [...marks];
  return marks.filter((mark) =>
    paths.some((path) => mark === path || mark.startsWith(`${path}/`)),
  );
}

export function reviewedLayerMarks(
  marks: readonly ReviewedLayerMark[],
  layers: readonly ReviewLayer[],
): ListedReviewedLayerMark[] {
  return layers.flatMap((layer) => {
    const candidates = marks.filter((mark) => mark.layerId === layer.id);
    const mark =
      candidates.find((mark) => mark.fingerprint === layer.fingerprint) ??
      candidates.at(-1);
    return mark === undefined
      ? []
      : [{ ...mark, stale: mark.fingerprint !== layer.fingerprint }];
  });
}

export function reviewedMarks(
  marks: readonly ReviewedFileMark[],
): ReviewedMark[] {
  return marks.map(({ path, fingerprint, reviewedAt }) => ({
    path,
    fingerprint,
    reviewedAt,
  }));
}
