import type { ReadCommitFilesResponse } from '@porcelain/contracts/changes';

export type CommitFiles = ReadCommitFilesResponse;
export type CommitFile = CommitFiles['files'][number];

export function commitMessage(commit: {
  subject: string;
  body?: string | undefined;
}): string {
  return commit.body == null
    ? commit.subject
    : `${commit.subject}\n\n${commit.body}`;
}
