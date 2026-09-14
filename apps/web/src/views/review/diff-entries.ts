import { type FileDiffMetadata, parsePatchFiles } from '@pierre/diffs';
import type { Change, Diff } from '../../domain/review';
import { changePath } from '../../domain/review';
import type { CodeEntry } from './code-document';

export const MAX_PARSED_DIFFS = 128;
const parsedDiffs = new Map<string, FileDiffMetadata | null>();
type OrdinaryChange = Extract<Change, { kind: string }>;

function contentVersion(value: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 1;
}

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
