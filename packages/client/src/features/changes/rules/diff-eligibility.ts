import type { CommitFile, DiffContent } from './changes.ts';

const SUBMODULE_MODE = '160000';

export function isSubmoduleChange(modes: { oldMode: string; newMode: string }) {
  return modes.oldMode === SUBMODULE_MODE || modes.newMode === SUBMODULE_MODE;
}

export function showsWorktreeDiff(content: DiffContent) {
  return content.kind === 'text' || content.kind === 'metadata-only';
}

export function commitDiffPath(
  file: CommitFile,
  content: DiffContent | undefined,
) {
  if (isSubmoduleChange(file)) return null;
  if (content?.kind !== 'text') return null;
  return file.newPath ?? file.oldPath ?? null;
}
