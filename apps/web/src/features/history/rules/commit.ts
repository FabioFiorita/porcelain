import type { ReadCommitFilesResponse } from '@porcelain/contracts/changes';

export type CommitFiles = ReadCommitFilesResponse;
export type CommitFile = CommitFiles['files'][number];
