import type { FileChange } from '@porcelain/kernel/models';
import { expectationHolds } from '@porcelain/kernel/rules';
import type { ReviewTexts } from '../models/review-evidence.ts';
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
import { currentLayerFingerprint } from './resolve-review.ts';

export function selectReviewedFiles(
  files: readonly ReviewedFile[],
  changes: readonly FileChange[],
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
): string[] {
  const remarked = new Set(marking.map((file) => file.path));
  const kept = existing.filter((mark) => !remarked.has(mark.path));
  const excess = kept.length + marking.length - limit;
  if (excess <= 0) return [];
  return [...kept]
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

function markIsStale(
  mark: { fingerprint: string },
  key: string,
  current: ReadonlyMap<string, string | undefined>,
): boolean {
  return current.get(key) !== mark.fingerprint;
}

export function reviewedLayerMarks(
  marks: readonly ReviewedLayerMark[],
  layers: readonly ReviewLayer[],
  texts: ReviewTexts,
): ListedReviewedLayerMark[] {
  const current = currentLayerFingerprints(layers, texts);
  return marks.map((mark) => ({
    ...mark,
    stale: markIsStale(mark, mark.layerId, current),
  }));
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

export function markedLayers(
  layers: readonly ReviewLayer[],
  marks: readonly ReviewedLayerMark[],
): ReviewLayer[] {
  const marked = new Set(marks.map((mark) => mark.layerId));
  return layers.filter((layer) => marked.has(layer.id));
}

export function currentLayerFingerprints(
  layers: readonly ReviewLayer[],
  texts: ReviewTexts,
): Map<string, string> {
  return new Map(
    layers.map((layer) => [layer.id, currentLayerFingerprint(layer, texts)]),
  );
}
