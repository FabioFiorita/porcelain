import { structuredPatch } from 'diff';
import type { CommentThread, ThreadLocation } from '../contracts/comments';
import type { WorktreeSignal } from '../contracts/inventory';
import type {
  NotExplained,
  ReviewResponse,
  StepLocation,
} from '../contracts/review';
import { contentFingerprint } from '../domain/review';
import type { FileSeed } from './fixtures/types';
import { unifiedPatch } from './mock-patch';
import type {
  StoredLayer,
  StoredStep,
  StoredThread,
  WorktreeState,
} from './mock-store';

/**
 * What the server computes on every read of a review, a mark or a thread: where
 * the code is now, what no step explains, and the fingerprints marks compare with.
 * Pure functions over the mock's worktree state.
 */

/** A file's lines without the empty string after its final newline. */
export function textLines(text: string): string[] {
  const lines = text.split('\n');
  if (lines.at(-1) === '') lines.pop();
  return lines;
}

/**
 * Where `block` sits in `lines` (1-based start), preferring the occurrence closest to
 * `near`; null when the text is gone. This is the "re-find" behind steps and threads.
 */
export function findBlock(
  lines: readonly string[],
  block: readonly string[],
  near: number,
): number | null {
  if (block.length === 0) return null;
  let best: number | null = null;
  for (let start = 0; start + block.length <= lines.length; start += 1) {
    if (block.every((line, offset) => lines[start + offset] === line)) {
      const candidate = start + 1;
      if (best == null || Math.abs(candidate - near) < Math.abs(best - near))
        best = candidate;
    }
  }
  return best;
}

/** Ignored paths are untracked as far as git status goes: never a change. */
export const ignoredPath = (worktree: WorktreeState, path: string) =>
  worktree.ignored.some(
    (rule) => path === rule || (rule.endsWith('/') && path.startsWith(rule)),
  );

export const changedPaths = (worktree: WorktreeState) =>
  [...worktree.files.entries()]
    .filter(
      ([path, file]) =>
        file.head !== file.working && !ignoredPath(worktree, path),
    )
    .map(([path]) => path)
    .sort();

export const patchFor = (worktree: WorktreeState, path: string) => {
  const file = worktree.files.get(path);
  return file == null || file.binary != null
    ? ''
    : unifiedPatch(path, file.head, file.working);
};

/** The cheap "did it change" signal the list of changes carries (a blob id, or size and time, live). */
export const fileFingerprint = (worktree: WorktreeState, path: string) =>
  contentFingerprint(
    `${path}\0${worktree.files.get(path)?.working ?? '\0deleted'}`,
  );

/**
 * New-side line numbers that differ from the last commit. A deletion marks the line
 * that now sits where it was, so removed code still counts as changed.
 */
export function changedLines(file: FileSeed | undefined): Set<number> {
  const changed = new Set<number>();
  if (file?.working == null || file.binary != null) return changed;
  if (file.head == null) {
    textLines(file.working).forEach((_, index) => {
      changed.add(index + 1);
    });
    return changed;
  }
  if (file.head === file.working) return changed;
  const total = textLines(file.working).length;
  for (const hunk of structuredPatch(
    'a',
    'b',
    file.head,
    file.working,
    '',
    '',
    { context: 0 },
  ).hunks) {
    let line = hunk.newStart;
    for (const text of hunk.lines) {
      if (text.startsWith('+')) {
        changed.add(line);
        line += 1;
      } else if (text.startsWith('-')) {
        changed.add(Math.max(1, Math.min(line, total)));
      }
    }
  }
  return changed;
}

export function stepLocation(
  worktree: WorktreeState,
  step: StoredStep,
): StepLocation {
  const file = worktree.files.get(step.pointer.path);
  if (file?.working == null) return { state: 'changed' };
  const start = findBlock(
    textLines(file.working),
    step.published,
    step.pointer.startLine,
  );
  if (start == null) return { state: 'changed' };
  const endLine = start + step.published.length - 1;
  if (step.kind === 'context')
    return { state: 'current', startLine: start, endLine };
  const changed = changedLines(file);
  for (let line = start; line <= endLine; line += 1) {
    if (changed.has(line))
      return { state: 'current', startLine: start, endLine };
  }
  return { state: 'committed', startLine: start, endLine };
}

/** Computed from the code the layer's changed steps cover, so any later edit there moves it. */
export function layerFingerprint(
  worktree: WorktreeState,
  layer: StoredLayer,
): string {
  const parts = layer.steps
    .filter((step) => step.kind === 'changed')
    .map((step) => {
      const location = stepLocation(worktree, step);
      if (location.state === 'changed') return `${step.id}:changed`;
      const lines = textLines(
        worktree.files.get(step.pointer.path)?.working ?? '',
      );
      return `${step.id}:${lines.slice(location.startLine - 1, location.endLine).join('\n')}`;
    });
  return contentFingerprint(parts.join('\0'));
}

function ranges(
  lines: readonly number[],
): { startLine: number; endLine: number }[] {
  const sorted = [...lines].sort((left, right) => left - right);
  const result: { startLine: number; endLine: number }[] = [];
  for (const line of sorted) {
    const last = result.at(-1);
    if (last != null && line === last.endLine + 1) last.endLine = line;
    else result.push({ startLine: line, endLine: line });
  }
  return result;
}

/** Lines that never need explaining on their own: blank, imports, comments, lone closing brackets. */
const IGNORABLE =
  /^\s*(?:$|import\b|export \* from|export \{[^}]*\} from|\/\/|\/\*|\*|\*\/|[)\]}]+[;,]?$)/;

/** The paragraph (run of non-blank lines) around `line`, 1-based. */
function paragraph(lines: readonly string[], line: number): [number, number] {
  let start = line;
  let end = line;
  while (start > 1 && (lines[start - 2] ?? '').trim() !== '') start -= 1;
  while (end < lines.length && (lines[end] ?? '').trim() !== '') end += 1;
  return [start, end];
}

/**
 * Changed lines no current changed step explains. Always listed, so nothing hides
 * by omission. Blank lines, imports, comments and lone closing brackets do not count,
 * and a step that covers part of a paragraph explains that paragraph.
 */
export function notExplained(
  worktree: WorktreeState,
  layers: readonly StoredLayer[],
): NotExplained[] {
  const covered = new Map<string, Set<number>>();
  for (const step of layers.flatMap((layer) => layer.steps)) {
    if (step.kind !== 'changed') continue;
    const location = stepLocation(worktree, step);
    if (location.state === 'changed') continue;
    const lines = covered.get(step.pointer.path) ?? new Set<number>();
    for (let line = location.startLine; line <= location.endLine; line += 1)
      lines.add(line);
    covered.set(step.pointer.path, lines);
  }
  return changedPaths(worktree).flatMap((path): NotExplained[] => {
    const file = worktree.files.get(path);
    if (file?.working == null) return [{ path, ranges: [], deleted: true }];
    if (file.binary != null) return [{ path, ranges: [], binary: true }];
    const lines = textLines(file.working);
    const mine = covered.get(path) ?? new Set<number>();
    const left = [...changedLines(file)].filter((line) => {
      if (IGNORABLE.test(lines[line - 1] ?? '')) return false;
      const [start, end] = paragraph(lines, line);
      for (let candidate = start; candidate <= end; candidate += 1)
        if (mine.has(candidate)) return false;
      return true;
    });
    return left.length === 0 ? [] : [{ path, ranges: ranges(left) }];
  });
}

/** The review as GET /review answers it, or null when there is none or nothing it describes is uncommitted. */
export function reviewResponse(
  worktree: WorktreeState,
  worktreeId: string,
  summaryUrl = '',
): ReviewResponse | null {
  const review = worktree.review;
  if (review == null) return null;
  const layers = review.layers.map(({ steps, ...layer }) => ({
    ...layer,
    fingerprint: layerFingerprint(worktree, { ...layer, steps }),
    steps: steps.map((stored) => {
      const { published: _published, ...step } = stored;
      return { ...step, location: stepLocation(worktree, stored) };
    }),
  }));
  const changedSteps = layers
    .flatMap((layer) => layer.steps)
    .filter((step) => step.kind === 'changed');
  if (
    changedSteps.length > 0 &&
    changedSteps.every((step) => step.location.state === 'committed')
  )
    return null;
  return {
    worktreeId,
    revision: review.revision,
    publishedAt: review.publishedAt,
    summary: {
      url: summaryUrl,
      byteLength: new TextEncoder().encode(review.summaryHtml).byteLength,
    },
    diagram: review.diagram,
    layers,
    notExplained: notExplained(worktree, review.layers),
  };
}

function threadLocation(
  worktree: WorktreeState,
  thread: StoredThread,
): ThreadLocation | undefined {
  const anchor = thread.anchor;
  if (anchor.kind === 'worktree' || anchor.revision != null) return undefined;
  const file = worktree.files.get(anchor.filePath);
  if (anchor.kind === 'file') {
    // A file deleted but not committed yet is still there to talk about: its deletion is the change.
    return file == null || (file.working == null && file.head == null)
      ? { state: 'outdated' }
      : { state: 'current', filePath: anchor.filePath };
  }
  if (anchor.side === 'deletions') {
    // Deleted lines live in the last commit; they stay current while the deletion is uncommitted.
    return file != null && file.head !== file.working
      ? {
          state: 'current',
          filePath: anchor.filePath,
          startLine: anchor.startLine,
          endLine: anchor.endLine,
        }
      : { state: 'outdated' };
  }
  if (file?.working == null || thread.snapshot == null)
    return { state: 'outdated' };
  const block = thread.snapshot.text.split('\n');
  const start = findBlock(textLines(file.working), block, anchor.startLine);
  if (start == null) return { state: 'outdated' };
  const endLine = start + block.length - 1;
  const changed = changedLines(file);
  let stillChanged = false;
  for (let line = start; line <= endLine; line += 1)
    if (changed.has(line)) stillChanged = true;
  const state = thread.onChange && !stillChanged ? 'committed' : 'current';
  return { state, filePath: anchor.filePath, startLine: start, endLine };
}

/** A thread as GET /comments answers it: where its code is now. */
export function threadView(
  worktree: WorktreeState,
  thread: StoredThread,
): CommentThread {
  const { onChange: _onChange, ...rest } = thread;
  return structuredClone({
    ...rest,
    location: threadLocation(worktree, thread),
  });
}

/** The sidebar dot: computed from stored state with the list, never from Git history. */
export function worktreeSignal(worktree: WorktreeState): WorktreeSignal {
  const agentReplied = worktree.threads.some((thread) => {
    if (thread.resolved) return false;
    const seenIndex = thread.messages.findIndex(
      (message) => message.id === thread.seenUpTo,
    );
    return thread.messages
      .slice(seenIndex + 1)
      .some((message) => message.author === 'agent');
  });
  const review = reviewResponse(worktree, '');
  if (review == null) return { review: null, agentReplied };
  const reviewed = review.layers.every((layer) => {
    const mark = worktree.marks.get(`layer:${layer.id}`);
    return mark != null && mark.fingerprint === layer.fingerprint;
  });
  return { review: reviewed ? 'reviewed' : 'ready', agentReplied };
}
