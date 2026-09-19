import { type FileDiffMetadata, parsePatchFiles } from '@pierre/diffs';
import type { CommitDiffResponse } from '../../contracts/commit-history';
import type {
  GitChange,
  GitDiffResponse,
  TextRangeResponse,
} from '../../contracts/git-status';
import { contentFingerprint } from '../../domain/review';
import type { CodeEntry } from './code-document';
import { contextPatch, focusPatch, type LineSpan } from './patch-focus';

export type DiffEntry = Extract<CodeEntry, { kind: 'diff' }>;

/**
 * A changed file Git reports as binary: no lines to show or comment on, only the
 * file. `before` is its path at the last commit and `after` its path on disk; an
 * added file has no before, a deleted one no after.
 */
export type BinaryEntry = {
  path: string;
  fingerprint: string;
  before: string | null;
  after: string | null;
};

export function binaryEntry(
  path: string,
  change: GitChange,
  response: GitDiffResponse,
): BinaryEntry | null {
  if (response.content.kind !== 'binary' || change.scope === 'unmerged')
    return null;
  if (change.scope === 'untracked')
    return { path, fingerprint: change.fingerprint, before: null, after: path };
  return {
    path,
    fingerprint: change.fingerprint,
    before: change.oldPath,
    after: change.newPath,
  };
}

/**
 * Parsed diffs are cached by the response object the query cache hands out (and
 * by the focus, when only part of the diff is shown). CodeView keys re-renders on
 * `version`, so the same response must always yield the same FileDiffMetadata
 * object; re-parsing on every render gives Pierre a new diff under an unchanged
 * version and it refuses to render it.
 */
const parsed = new WeakMap<
  object,
  Map<string, { fileDiff: FileDiffMetadata; patch: string } | null>
>();

function parseOnce(
  source: object,
  key: string,
  patch: () => string | null,
  cachePrefix: string,
) {
  let byKey = parsed.get(source);
  if (byKey == null) {
    byKey = new Map();
    parsed.set(source, byKey);
  }
  if (!byKey.has(key)) {
    const text = patch();
    const fileDiff =
      text == null
        ? undefined
        : parsePatchFiles(text, `${cachePrefix}:${contentFingerprint(text)}`)[0]
            ?.files[0];
    byKey.set(
      key,
      fileDiff == null || text == null ? null : { fileDiff, patch: text },
    );
  }
  return byKey.get(key) ?? null;
}

const spansKey = (spans?: readonly LineSpan[]) =>
  spans == null
    ? 'all'
    : spans.map((span) => `${span.startLine}-${span.endLine}`).join(',');

/** The patch text a diff response carries, when it has one. */
export function patchText(response: GitDiffResponse): string | null {
  return response.content.kind === 'text' ||
    response.content.kind === 'metadata-only'
    ? response.content.patch
    : null;
}

/**
 * A worktree diff as a CodeView entry. `fingerprint` is the change's, from the list
 * of changes: a file tick stores it. `focus` keeps only the hunks near those lines.
 */
export function diffEntry(
  path: string,
  response: GitDiffResponse,
  fingerprint: string,
  options: { note?: string; focus?: readonly LineSpan[] } = {},
): DiffEntry | null {
  const full = patchText(response);
  if (full == null) return null;
  const result = parseOnce(
    response,
    spansKey(options.focus),
    () => (options.focus == null ? full : focusPatch(full, options.focus)),
    path,
  );
  if (result == null) return null;
  return {
    kind: 'diff',
    path,
    fileDiff: result.fileDiff,
    fingerprint,
    note: options.note,
  };
}

/** A focused diff for one block of a layer, with the patch it was cut to (to place threads). */
export function focusedDiff(
  path: string,
  response: GitDiffResponse,
  focus: readonly LineSpan[],
) {
  const full = patchText(response);
  if (full == null) return null;
  return parseOnce(
    response,
    spansKey(focus),
    () => focusPatch(full, focus),
    path,
  );
}

/** Unchanged lines as a context-only diff, so they render with their real line numbers. */
export function contextDiff(range: TextRangeResponse) {
  return parseOnce(
    range,
    'context',
    () =>
      range.lines.length === 0
        ? null
        : contextPatch(range.path, range.startLine, range.lines),
    range.path,
  );
}

/** A file of a commit. Its "fingerprint" only keys re-renders: commits are never ticked. */
export function commitEntry(
  oid: string,
  response: CommitDiffResponse,
): DiffEntry | null {
  if (response.patch.kind !== 'text') return null;
  const text = response.patch.text;
  const result = parseOnce(
    response,
    'all',
    () => text,
    `${oid}:${response.path}`,
  );
  if (result == null) return null;
  return {
    kind: 'diff',
    path: response.path,
    fileDiff: result.fileDiff,
    fingerprint: contentFingerprint(text),
  };
}
