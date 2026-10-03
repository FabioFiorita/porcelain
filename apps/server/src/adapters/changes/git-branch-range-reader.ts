import type {
  BranchBases,
  BranchPatches,
  BranchPatchesRequest,
  BranchRangeLookup,
  BranchRangeRequest,
  ListBranchBasesInput,
} from '@porcelain/changes/models';
import type { BranchRangeReader } from '@porcelain/changes/ports';
import type { CommitReaderFactory } from '@porcelain/git/history';
import {
  listedWorktree,
  type ListedWorktrees,
} from '../projects/checkout-session.ts';

type CommitReader = ReturnType<CommitReaderFactory>;

export class GitBranchRangeReader implements BranchRangeReader {
  private readonly worktrees: ListedWorktrees;
  private readonly git: CommitReaderFactory;

  constructor(worktrees: ListedWorktrees, git: CommitReaderFactory) {
    this.worktrees = worktrees;
    this.git = git;
  }

  async readBranchRange(
    input: BranchRangeRequest,
    signal?: AbortSignal,
  ): Promise<BranchRangeLookup> {
    const reader = await this.reader(input.worktreeId, signal);
    const range = await reader.readBranchRange(
      input.base === undefined ? {} : { base: input.base },
      signal,
    );
    switch (range.kind) {
      case 'found':
        return {
          kind: 'found',
          head: { oid: range.head.oid, ref: range.head.ref ?? undefined },
          base: range.base,
          mergeBaseOid: range.mergeBaseOid,
          commits: range.commits,
          files: range.files.map((file) => ({
            oldPath: file.oldPath ?? undefined,
            newPath: file.newPath ?? undefined,
            status: file.status,
            oldMode: file.oldMode,
            newMode: file.newMode,
            oldOid: file.oldOid ?? undefined,
            newOid: file.newOid ?? undefined,
          })),
        };
      case 'no-default-base':
        return {
          kind: 'no-default-base',
          head: { oid: range.head.oid, ref: range.head.ref ?? undefined },
        };
      default:
        return range;
    }
  }

  async readBranchPatches(
    input: BranchPatchesRequest,
    signal?: AbortSignal,
  ): Promise<BranchPatches> {
    const reader = await this.reader(input.worktreeId, signal);
    const read = await reader.readBranchDiffs(
      { baseOid: input.baseOid, headOid: input.headOid, paths: input.paths },
      signal,
    );
    if (read.kind === 'missing') return read;
    if (read.sections === null) return { kind: 'over-limit' };
    return {
      kind: 'within-limit',
      patches: [...read.sections].map(([key, content]) => ({
        paths: key.split('\0'),
        content,
      })),
    };
  }

  async listBranchBases(
    input: ListBranchBasesInput,
    signal?: AbortSignal,
  ): Promise<BranchBases> {
    const reader = await this.reader(input.worktreeId, signal);
    const listed = await reader.listBranchBases(signal);
    return { defaultRef: listed.defaultRef ?? undefined, bases: listed.bases };
  }

  private async reader(
    worktreeId: string,
    signal?: AbortSignal,
  ): Promise<CommitReader> {
    signal?.throwIfAborted();
    const worktree = await listedWorktree(this.worktrees, worktreeId, signal);
    return this.git({
      path: worktree.path,
      commonDirectory: worktree.commonDirectory,
      administrativeDirectory: worktree.administrativeDirectory,
      repositoryIdentity: worktree.repositoryIdentity,
      metadataIdentity: worktree.metadataIdentity,
    });
  }
}
