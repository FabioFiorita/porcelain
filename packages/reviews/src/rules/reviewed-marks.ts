import type { ReadChangesResult } from '../models/review-evidence.ts';
import type {
  ReviewedFileConflict,
  ReviewedFileMark,
  ReviewedFileSelection,
  ReviewedMark,
} from '../models/reviewed-mark.ts';

export const REVIEWED_MARKS_PER_WORKTREE = 2000;

export function evictionCount(marks: number): number {
  return Math.max(0, marks - REVIEWED_MARKS_PER_WORKTREE + 1);
}

export function selectReviewedFiles(
  files: readonly { path: string; fingerprint: string }[],
  changes: ReadChangesResult,
): ReviewedFileSelection {
  const latest = new Map(files.map((file) => [file.path, file.fingerprint]));
  const current = new Map(
    changes.changes.map((change) => [change.path, change]),
  );
  const marked: { path: string; fingerprint: string }[] = [];
  const conflicts: ReviewedFileConflict[] = [];
  for (const [path, fingerprint] of latest) {
    const change = current.get(path);
    if (!change) conflicts.push({ path, reason: 'missing' });
    else if (change.fingerprint !== fingerprint)
      conflicts.push({ path, reason: 'stale' });
    else marked.push({ path, fingerprint });
  }
  return { marked, conflicts };
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
