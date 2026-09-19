import type { GitChange, GitChangeSelection } from '../contracts/git-status';
import type { MarkTarget, ReviewedMark } from '../contracts/marks';
import type {
  NotExplained,
  ReviewLayer,
  ReviewResponse,
  ReviewStep,
} from '../contracts/review';

export type { ReviewLayer, ReviewResponse, ReviewStep };

/** One worktree of one project: what every worktree read and action is about. */
export type ReviewScope = { projectId: string; worktreeId: string };

/**
 * The right-hand surfaces, in order. `changes` is labelled "Review" once the agent
 * published a review. Git has no surface: its actions live in the Git button.
 */
export const SURFACES = ['changes', 'files', 'history'] as const;
export type Surface = (typeof SURFACES)[number];

export const SURFACE_LABELS: Record<Surface, string> = {
  /** Shown as Review once the agent publishes a review (`ChangesSurfaceLabel`). */
  changes: 'Changes',
  files: 'Files',
  history: 'History',
};

export function isSurface(value: unknown): value is Surface {
  return (
    typeof value === 'string' && (SURFACES as readonly string[]).includes(value)
  );
}

export function changePath(change: GitChange): string {
  if (change.scope === 'untracked' || change.scope === 'unmerged')
    return change.path;
  return change.newPath ?? change.oldPath ?? '';
}

export type ChangeKind =
  | 'added'
  | 'modified'
  | 'deleted'
  | 'renamed'
  | 'conflicted';

export function changeKind(change: GitChange): ChangeKind {
  if (change.scope === 'untracked') return 'added';
  if (change.scope === 'unmerged') return 'conflicted';
  if (change.kind === 'type-changed') return 'modified';
  return change.kind;
}

export type DocumentKind = 'markdown' | 'html' | 'code';

export function documentKind(path: string): DocumentKind {
  const lower = path.toLowerCase();
  if (lower.endsWith('.md') || lower.endsWith('.mdx')) return 'markdown';
  if (lower.endsWith('.html') || lower.endsWith('.htm')) return 'html';
  return 'code';
}

export const basename = (path: string) => path.split('/').pop() ?? path;

const IMAGE_EXTENSIONS = new Set([
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'avif',
  'bmp',
  'ico',
  'svg',
]);

/** Images the browser can draw from their preview link; judged by name, as Git does not say. */
export function isImagePath(path: string): boolean {
  const name = path.slice(path.lastIndexOf('/') + 1).toLowerCase();
  const dot = name.lastIndexOf('.');
  return dot > 0 && IMAGE_EXTENSIONS.has(name.slice(dot + 1));
}

/** A changed file as the list of changes shows it: once, however Git splits it. */
export type ListedChange = {
  path: string;
  /** The change whose diff the file shows and whose fingerprint its tick stores. */
  change: GitChange;
  /** `all` when every edit is in the index (`git add`), `part` when some are not yet. */
  staged: 'all' | 'part' | null;
};

/**
 * Git lists a file with both staged and unstaged edits twice. The reviewer sees
 * it once, diffed from the last commit to disk (`diffSelection`), so both edits
 * show. It keeps the unstaged change: its fingerprint is the file on disk's.
 */
export function listChanges(changes: readonly GitChange[]): ListedChange[] {
  const byPath = new Map<string, ListedChange>();
  for (const change of changes) {
    const path = changePath(change);
    const seen = byPath.get(path);
    if (seen == null) {
      byPath.set(path, {
        path,
        change,
        staged: change.scope === 'staged' ? 'all' : null,
      });
    } else if (seen.change.scope === 'staged' || change.scope === 'staged') {
      byPath.set(path, {
        path,
        change: change.scope === 'staged' ? seen.change : change,
        staged: 'part',
      });
    }
  }
  return [...byPath.values()];
}

/** Each changed file once, as the list of changes and the Git button count them. */
export const changedFiles = (changes: readonly GitChange[]) =>
  listChanges(changes).map((file) => file.path);

/** FNV-1a over the text, as hex. The mock's stand-in for the server's fingerprints. */
export function contentFingerprint(text: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export const markKey = (target: MarkTarget) =>
  target.kind === 'layer' ? `layer:${target.layerId}` : `file:${target.path}`;

export type ReviewState = 'unreviewed' | 'reviewed' | 'stale';

export function reviewState(mark: ReviewedMark | undefined): ReviewState {
  if (mark == null) return 'unreviewed';
  return mark.stale ? 'stale' : 'reviewed';
}

export type Marks = ReadonlyMap<string, ReviewedMark>;

export const layerState = (marks: Marks, layer: ReviewLayer) =>
  reviewState(marks.get(markKey({ kind: 'layer', layerId: layer.id })));

export const fileState = (marks: Marks, path: string) =>
  reviewState(marks.get(markKey({ kind: 'file', path })));

export type Progress = { done: number; total: number };

/** In a review the layers are what gets ticked. */
export function layerProgress(
  layers: readonly ReviewLayer[],
  marks: Marks,
): Progress {
  return {
    done: layers.filter((layer) => layerState(marks, layer) === 'reviewed')
      .length,
    total: layers.length,
  };
}

/** In plain Changes (and for code no step explains) files are ticked. */
export function fileProgress(paths: readonly string[], marks: Marks): Progress {
  return {
    done: paths.filter((path) => fileState(marks, path) === 'reviewed').length,
    total: paths.length,
  };
}

/** A layer's lane path, e.g. "Web hook → Route → Use case → Storage". */
export const lanePath = (layer: ReviewLayer) => layer.lanes.join(' → ');

export const stepLane = (layer: ReviewLayer, step: ReviewStep) =>
  layer.lanes[step.lane] ?? '';

/** Steps whose code is still uncommitted come first; committed ones fold away. */
export function activeSteps(layer: ReviewLayer): ReviewStep[] {
  return layer.steps.filter((step) => step.location.state !== 'committed');
}

/** Every step of the layer is committed: the layer reads "Committed" and needs no tick. */
export const layerCommitted = (layer: ReviewLayer) =>
  layer.steps.some((step) => step.kind === 'changed') &&
  layer.steps
    .filter((step) => step.kind === 'changed')
    .every((step) => step.location.state === 'committed');

/** Number of changed lines no step explains, and in how many files. */
/** "12 lines in 3 files", "1 binary file", or both; null when every change is explained. */
export function notExplainedLabel(
  entries: readonly NotExplained[],
): string | null {
  const count = (total: number, noun: string) =>
    `${total} ${noun}${total === 1 ? '' : 's'}`;
  const text = entries.filter((entry) => entry.binary !== true);
  const binary = entries.length - text.length;
  const parts = [
    ...(text.length > 0
      ? [
          `${count(notExplainedSummary(text).lines, 'line')} in ${count(text.length, 'file')}`,
        ]
      : []),
    ...(binary > 0 ? [count(binary, 'binary file')] : []),
  ];
  return parts.length === 0 ? null : parts.join(' and ');
}

export function notExplainedSummary(entries: readonly NotExplained[]): {
  lines: number;
  files: number;
} {
  return {
    lines: entries.reduce(
      (total, entry) =>
        total +
        entry.ranges.reduce(
          (sum, range) => sum + range.endLine - range.startLine + 1,
          0,
        ),
      0,
    ),
    files: entries.length,
  };
}

/** Conflicted entries cannot be diffed through GitDiffRequest; untracked files diff against nothing. */
export function diffSelection(change: GitChange): GitChangeSelection | null {
  if (change.scope === 'unmerged') return null;
  if (change.scope === 'untracked')
    return { scope: 'untracked', path: change.path };
  // What gets committed is the file on disk, so staged or not, the diff runs from the last commit.
  return { scope: 'head', oldPath: change.oldPath, newPath: change.newPath };
}
