import type {
  ReviewChange,
  ReviewDiagnostics,
  ReviewFiles,
  ReviewPatch,
} from '../models/review-evidence.ts';
import { textLines } from './review-evidence.ts';

const HUNK_HEADER = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

function addAll(
  target: Map<string, Set<number>>,
  path: string,
  lines: Iterable<number>,
): void {
  const existing = target.get(path) ?? new Set<number>();
  for (const line of lines) existing.add(line);
  target.set(path, existing);
}

function patchLineChanges(patch: string): {
  changed: Set<number>;
  deleted: Set<number>;
} {
  const changed = new Set<number>();
  const deleted = new Set<number>();
  let line = 0;
  for (const value of patch.split('\n')) {
    const header = HUNK_HEADER.exec(value);
    if (header) {
      line = Number(header[3]);
    } else if (value.startsWith('+') && !value.startsWith('+++')) {
      changed.add(Math.max(1, line));
      line += 1;
    } else if (value.startsWith('-') && !value.startsWith('---')) {
      const at = Math.max(1, line);
      changed.add(at);
      deleted.add(at);
    } else if (value.startsWith(' ')) {
      line += 1;
    }
  }
  return { changed, deleted };
}

function mapOldLine(patch: string, target: number): number | undefined {
  let oldLine = 1;
  let newLine = 1;
  for (const value of patch.split('\n')) {
    const header = HUNK_HEADER.exec(value);
    if (header) {
      const oldCount = header[2] === undefined ? 1 : Number(header[2]);
      const newCount = header[4] === undefined ? 1 : Number(header[4]);
      const nextOld = Number(header[1]) + (oldCount === 0 ? 1 : 0);
      const nextNew = Number(header[3]) + (newCount === 0 ? 1 : 0);
      if (target < nextOld) return target + (newLine - oldLine);
      oldLine = nextOld;
      newLine = nextNew;
    } else if (value.startsWith('-') && !value.startsWith('---')) {
      if (target === oldLine) return undefined;
      oldLine += 1;
    } else if (value.startsWith('+') && !value.startsWith('+++')) {
      newLine += 1;
    } else if (value.startsWith(' ')) {
      if (target === oldLine) return newLine;
      oldLine += 1;
      newLine += 1;
    }
  }
  return target + (newLine - oldLine);
}

function throughUnstaged(
  lines: Iterable<number>,
  unstaged: string | undefined,
): number[] {
  const mapped: number[] = [];
  for (const line of lines) {
    const target = unstaged === undefined ? line : mapOldLine(unstaged, line);
    if (target !== undefined) mapped.push(target);
  }
  return mapped;
}

export function reviewDiagnostics(
  changes: readonly ReviewChange[],
  files: ReviewFiles,
  patches: readonly ReviewPatch[],
): ReviewDiagnostics {
  const changed = new Map<string, Set<number>>();
  const deleted = new Map<string, Set<number>>();
  const binary = new Set<string>();
  const staged = new Map<string, Set<number>>();
  const stagedDeleted = new Map<string, Set<number>>();
  const unstagedPatches = new Map<string, string>();
  for (const file of changes)
    if (file.untracked)
      changed.set(
        file.path,
        new Set(
          textLines(files.get(file.path) ?? '').map((_, index) => index + 1),
        ),
      );
  for (const entry of patches) {
    if (entry.kind === 'binary') {
      binary.add(entry.path);
      continue;
    }
    const patch = patchLineChanges(entry.patch);
    if (entry.scope === 'staged') {
      addAll(staged, entry.path, patch.changed);
      addAll(stagedDeleted, entry.path, patch.deleted);
    } else {
      unstagedPatches.set(entry.path, entry.patch);
      addAll(changed, entry.path, patch.changed);
      addAll(deleted, entry.path, patch.deleted);
    }
  }
  for (const [path, lines] of staged) {
    const unstaged = unstagedPatches.get(path);
    addAll(changed, path, throughUnstaged(lines, unstaged));
    addAll(
      deleted,
      path,
      throughUnstaged(stagedDeleted.get(path) ?? [], unstaged),
    );
  }
  return { changed, deleted, binary };
}
