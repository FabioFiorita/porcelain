import type {
  ReviewChange,
  ReviewDiagnostics,
  ReviewPatch,
} from '../models/published-review.ts';

export class AssembleReviewDiagnosticsService {
  execute(
    changes: readonly ReviewChange[],
    files: ReadonlyMap<string, string>,
    patches: readonly ReviewPatch[],
  ): ReviewDiagnostics {
    const changed = new Map<string, Set<number>>();
    const binary = new Set<string>();
    const deleted = new Map<string, Set<number>>();
    const staged = new Map<string, Set<number>>();
    const stagedDeleted = new Map<string, Set<number>>();
    const unstagedPatches = new Map<string, string>();
    for (const file of changes) {
      if (file.untracked)
        changed.set(
          file.path,
          new Set(
            textLines(files.get(file.path) ?? '').map((_, index) => index + 1),
          ),
        );
    }
    for (const entry of patches) {
      if (entry.kind === 'binary') {
        binary.add(entry.path);
        continue;
      }
      if (entry.scope === 'staged') {
        const lines = staged.get(entry.path) ?? new Set<number>();
        const patch = patchLineChanges(entry.patch);
        for (const line of patch.changed) lines.add(line);
        staged.set(entry.path, lines);
        const removals = stagedDeleted.get(entry.path) ?? new Set<number>();
        for (const line of patch.deleted) removals.add(line);
        stagedDeleted.set(entry.path, removals);
      } else {
        unstagedPatches.set(entry.path, entry.patch);
        const lines = changed.get(entry.path) ?? new Set<number>();
        const patch = patchLineChanges(entry.patch);
        for (const line of patch.changed) lines.add(line);
        changed.set(entry.path, lines);
        const removals = deleted.get(entry.path) ?? new Set<number>();
        for (const line of patch.deleted) removals.add(line);
        deleted.set(entry.path, removals);
      }
    }
    for (const [path, lines] of staged) {
      const destination = changed.get(path) ?? new Set<number>();
      const unstaged = unstagedPatches.get(path);
      for (const line of lines) {
        const mapped =
          unstaged === undefined ? line : mapOldLine(unstaged, line);
        if (mapped !== undefined) destination.add(mapped);
      }
      changed.set(path, destination);
      const removals = deleted.get(path) ?? new Set<number>();
      for (const line of stagedDeleted.get(path) ?? []) {
        const mapped =
          unstaged === undefined ? line : mapOldLine(unstaged, line);
        if (mapped !== undefined) removals.add(mapped);
      }
      deleted.set(path, removals);
    }
    return { changed, deleted, binary };
  }
}

function patchLineChanges(patch: string): {
  changed: Set<number>;
  deleted: Set<number>;
} {
  const changed = new Set<number>();
  const deleted = new Set<number>();
  let line = 0;
  for (const value of patch.split('\n')) {
    const header = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(value);
    if (header) {
      line = Number(header[1]);
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
    const header = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(value);
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

function textLines(text: string): string[] {
  const lines = text.split('\n');
  if (lines.at(-1) === '') lines.pop();
  return lines;
}
