import { parsePatchFiles, type FileDiffMetadata } from '@pierre/diffs';
import { contentVersion } from '@/shared/lib/pierre';
import {
  changePath,
  type Change,
  type CommitFile,
  type DiffContent,
} from '../rules/changes';
import { commitDiffPath, showsWorktreeDiff } from '../rules/diff-eligibility';

type OrdinaryChange = Extract<Change, { kind: string }>;
type DiffEntry = {
  id: string;
  kind: 'diff';
  path: string;
  fileDiff: FileDiffMetadata;
  version: number;
  note: string;
};

export function changeId(change: Change) {
  return `change:${change.scope}:${changePath(change)}`;
}

export function diffEntry(
  change: OrdinaryChange,
  content: DiffContent,
): DiffEntry | null {
  if (!showsWorktreeDiff(content)) return null;
  const version = contentVersion(content.patch);
  const files = parsePatchFiles(
    content.patch,
    `${changeId(change)}:${version}`,
  ).flatMap((group) => group.files);
  const fileDiff = files.length === 1 ? files[0] : undefined;
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

export function commitEntry(
  oid: string,
  file: CommitFile,
  content: DiffContent | undefined,
): DiffEntry | null {
  const path = commitDiffPath(file, content);
  if (!path || content?.kind !== 'text') return null;
  const patchVersion = contentVersion(content.patch);
  const fileDiff = parsePatchFiles(
    content.patch,
    `${oid}:${path}:${patchVersion}`,
  )[0]?.files[0];
  if (!fileDiff) return null;
  return {
    id: `commit:${oid}:${path}`,
    kind: 'diff',
    path,
    fileDiff,
    version: patchVersion,
    note: file.status,
  };
}
