import { type FileDiffMetadata, parsePatchFiles } from '@pierre/diffs';
import type { Change, CommitChanges, Diff } from '../../domain/review';
import { changePath } from '../../domain/review';
import { contentVersion } from '../../lib/pierre';
import type { CodeEntry } from './code-document';

export const MAX_PARSED_DIFFS = 128;
const parsedDiffs = new Map<string, FileDiffMetadata | null>();
const parsedCommits = new WeakMap<object, FileDiffMetadata | null>();
type OrdinaryChange = Extract<Change, { kind: string }>;

export function evidenceId(change: Change) {
  return `change:${change.scope}:${changePath(change)}`;
}

export function diffEntry(
  change: OrdinaryChange,
  response: Diff,
): CodeEntry | null {
  if (response.content.kind === 'binary' || response.content.kind === 'omitted')
    return null;
  const path = changePath(change);
  const version = contentVersion(response.content.patch);
  const cacheKey = `${response.statusToken}:${evidenceId(change)}:${version}`;
  let fileDiff: FileDiffMetadata | null;
  if (parsedDiffs.has(cacheKey)) {
    fileDiff = parsedDiffs.get(cacheKey) ?? null;
    // Refresh the entry's position so frequently revisited files stay warm.
    parsedDiffs.delete(cacheKey);
    parsedDiffs.set(cacheKey, fileDiff);
  } else {
    const parsed = parsePatchFiles(
      response.content.patch,
      `${response.statusToken}:${evidenceId(change)}`,
    ).flatMap((group) => group.files);
    fileDiff = parsed.length === 1 ? (parsed[0] ?? null) : null;
    parsedDiffs.set(cacheKey, fileDiff);
    if (parsedDiffs.size > MAX_PARSED_DIFFS) {
      const oldest = parsedDiffs.keys().next().value;
      if (oldest !== undefined) parsedDiffs.delete(oldest);
    }
  }
  if (!fileDiff) return null;
  return {
    id: evidenceId(change),
    kind: 'diff',
    path,
    fileDiff,
    version,
    note: `${change.scope} · ${change.kind}`,
  };
}

export function fileEntry(
  id: string,
  path: string,
  contents: string,
  note?: string,
): CodeEntry {
  return {
    id,
    kind: 'file',
    path,
    contents,
    version: contentVersion(contents),
    ...(note ? { note } : {}),
  };
}

/** Turn a textual commit patch into the same Pierre entry used by review diffs. */
export function commitEntry(
  oid: string,
  change: CommitChanges['changes'][number],
): CodeEntry | null {
  if (change.patch.kind !== 'text') return null;
  const path = change.newPath ?? change.oldPath ?? '';
  if (path === '') return null;
  if (!parsedCommits.has(change)) {
    const patchVersion = contentVersion(change.patch.text);
    parsedCommits.set(
      change,
      parsePatchFiles(change.patch.text, `${oid}:${path}:${patchVersion}`)[0]
        ?.files[0] ?? null,
    );
  }
  const fileDiff = parsedCommits.get(change);
  if (!fileDiff) return null;
  return {
    id: `commit:${oid}:${path}`,
    kind: 'diff',
    path,
    fileDiff,
    version: contentVersion(change.patch.text),
    note: change.status,
  };
}
