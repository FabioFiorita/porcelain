import type { CommitFile, DiffContent } from './changes';

export function showsWorktreeDiff(content: DiffContent) {
  return content.kind === 'text' || content.kind === 'metadata-only';
}

export function commitDiffPath(
  file: CommitFile,
  content: DiffContent | undefined,
) {
  if (file.oldMode === '160000' || file.newMode === '160000') return null;
  if (content?.kind !== 'text') return null;
  return file.newPath ?? file.oldPath ?? null;
}
