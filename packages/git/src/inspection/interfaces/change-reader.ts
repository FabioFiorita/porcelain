import type { GitBranchDetails } from '../dtos/git-status.ts';
import type { HeadBlob, HeadBlobRequest } from '../dtos/head-blob.ts';

export interface ChangeReader {
  readSubmoduleHeads(
    paths: readonly string[],
    signal?: AbortSignal,
  ): Promise<Map<string, string>>;
  readBranchDetails(
    branch: string | null,
    headOid: string | null,
    signal?: AbortSignal,
  ): Promise<GitBranchDetails>;
  readHeadBlob(
    request: HeadBlobRequest,
    signal?: AbortSignal,
  ): Promise<HeadBlob>;
}
