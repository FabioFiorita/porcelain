import { type FileDiffMetadata, parsePatchFiles } from '@pierre/diffs';
import type { Change, CommitFile, DiffContent } from '../../domain/review';
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

/**
 * Turn a textual commit patch into the same Pierre entry used by review diffs.
 *
 * The patch arrives separately from the file it belongs to, so a file whose
 * patch has not been read yet has no entry rather than an empty one.
 */
export function commitEntry(
  oid: string,
  file: CommitFile,
  content: DiffContent | undefined,
): CodeEntry | null {
  // A gitlink's patch is two lines naming commits in another repository, not
  // code, and Pierre has nothing useful to draw for it.
  if (file.oldMode === '160000' || file.newMode === '160000') return null;
  if (content?.kind !== 'text') return null;
  const path = file.newPath ?? file.oldPath ?? '';
  if (path === '') return null;
  if (!parsedCommits.has(content)) {
    const patchVersion = contentVersion(content.patch);
    parsedCommits.set(
      content,
      parsePatchFiles(content.patch, `${oid}:${path}:${patchVersion}`)[0]
        ?.files[0] ?? null,
    );
  }
  const fileDiff = parsedCommits.get(content);
  if (!fileDiff) return null;
  return {
    id: `commit:${oid}:${path}`,
    kind: 'diff',
    path,
    fileDiff,
    version: contentVersion(content.patch),
    note: file.status,
  };
}
