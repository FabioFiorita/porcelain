import { type FileDiffMetadata, parsePatchFiles } from '@pierre/diffs';
import type { Change, Diff } from '../../domain/review';
import { changePath } from '../../domain/review';
import type { CodeEntry } from './code-document';

const parsedDiffs = new WeakMap<Diff, FileDiffMetadata | null>();
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
  if (!parsedDiffs.has(response)) {
    const parsed = parsePatchFiles(
      response.content.patch,
      `${response.statusToken}:${evidenceId(change)}`,
    ).flatMap((group) => group.files);
    parsedDiffs.set(response, parsed.length === 1 ? (parsed[0] ?? null) : null);
  }
  const fileDiff = parsedDiffs.get(response);
  if (!fileDiff) return null;
  return {
    id: evidenceId(change),
    kind: 'diff',
    path,
    fileDiff,
    version: contentVersion(response.content.patch),
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
