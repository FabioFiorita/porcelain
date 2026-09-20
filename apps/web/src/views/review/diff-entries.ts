import { type FileDiffMetadata, parsePatchFiles } from '@pierre/diffs';
import type { Change, CommitChanges, DiffContent } from '../../domain/review';
import { changePath } from '../../domain/review';
import { contentVersion } from '../../lib/pierre';
import type { CodeEntry } from './code-document';

const parsedDiffs = new WeakMap<
  object,
  { fileDiff: FileDiffMetadata | null; version: number }
>();
const parsedCommits = new WeakMap<object, FileDiffMetadata | null>();
type OrdinaryChange = Extract<Change, { kind: string }>;

export function changeId(change: Change) {
  return `change:${change.scope}:${changePath(change)}`;
}

export function diffEntry(
  change: OrdinaryChange,
  content: DiffContent,
): CodeEntry | null {
  if (content.kind === 'binary' || content.kind === 'omitted') return null;
  // The query keeps its content objects across renders and unchanged refetches.
  let parsed = parsedDiffs.get(content);
  if (!parsed) {
    const version = contentVersion(content.patch);
    const files = parsePatchFiles(
      content.patch,
      `${changeId(change)}:${version}`,
    ).flatMap((group) => group.files);
    parsed = {
      fileDiff: files.length === 1 ? (files[0] ?? null) : null,
      version,
    };
    parsedDiffs.set(content, parsed);
  }
  const { fileDiff, version } = parsed;
  if (!fileDiff) return null;
  return {
    id: changeId(change),
    kind: 'diff',
    path: changePath(change),
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
