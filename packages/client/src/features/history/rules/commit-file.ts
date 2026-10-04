import type { ReadCommitFilesResponse } from '@porcelain/contracts/changes';

export type CommitFile = ReadCommitFilesResponse['files'][number];

export function commitFilePaths(file: CommitFile): string[] {
  return [
    ...new Set([file.oldPath, file.newPath].filter((path) => path != null)),
  ];
}

export function commitFileLabel(file: CommitFile): string {
  return file.status === 'renamed'
    ? `${file.oldPath} → ${file.newPath}`
    : (file.newPath ?? file.oldPath ?? '');
}
