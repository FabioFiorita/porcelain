import type { FileChange } from '@porcelain/kernel/models';
import { expectationHolds } from '@porcelain/kernel/rules';
import type { ReviewFiles } from '../models/review-evidence.ts';
import type { ReviewLayer } from '../models/review.ts';
import type {
  ReviewedFile,
  ReviewedFileConflict,
  ReviewedFileMark,
  ReviewedFileSelection,
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
        left.reviewedAt.localeCompare(right.reviewedAt) ||
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

export function staleness(
  marks: readonly ReviewedFileMark[],
  fingerprints: ReadonlyMap<string, string | undefined>,
): { stale: string[]; fresh: string[] } {
  const stale: string[] = [];
  const fresh: string[] = [];
  for (const mark of marks) {
    const isStale = fingerprints.get(mark.path) !== mark.fingerprint;
    if (isStale === mark.stale) continue;
    (isStale ? stale : fresh).push(mark.path);
  }
  return { stale, fresh };
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

export function layerStaleness(
  marks: readonly ReviewedLayerMark[],
  layers: readonly ReviewLayer[],
  files: ReviewFiles,
): { stale: string[]; fresh: string[] } {
  const current = new Map(
    layers.map((layer) => [layer.id, currentLayerFingerprint(layer, files)]),
  );
  const stale: string[] = [];
  const fresh: string[] = [];
  for (const mark of marks) {
    const isStale = current.get(mark.layerId) !== mark.fingerprint;
    if (isStale === mark.stale) continue;
    (isStale ? stale : fresh).push(mark.layerId);
  }
  return { stale, fresh };
}
