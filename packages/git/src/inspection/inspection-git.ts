import { readBranchTracking } from './commands/read-branch-tracking.ts';
import { readDiff, readDiffs } from './commands/read-diff.ts';
import { readDiscarded } from './commands/read-discarded.ts';
import { readHeadBlob } from './commands/read-head-blob.ts';
import { readHeadCommit } from './commands/read-head-commit.ts';
import { readInProgress } from './commands/read-in-progress.ts';
import { readStashes } from './commands/read-stashes.ts';
import { readStatus } from './commands/read-status.ts';
import { readSubmoduleHeads } from './commands/read-submodule-heads.ts';
import { readUpstreamOid } from './commands/read-upstream-oid.ts';
import type { GitBranchDetails, GitOrdinaryChange } from './dtos/git-status.ts';
import type { HeadBlob, HeadBlobRequest } from './dtos/head-blob.ts';
import type { ChangeReader } from './interfaces/change-reader.ts';
import type { DiffReader } from './interfaces/diff-reader.ts';
import type { CheckoutSession } from './interfaces/git-session.ts';
import type { StatusReader } from './interfaces/status-reader.ts';

export class InspectionGit implements StatusReader, DiffReader, ChangeReader {
  private readonly session: CheckoutSession;

  constructor(session: CheckoutSession) {
    this.session = session;
  }

  async readStatus(signal?: AbortSignal) {
    await this.session.verify(signal);
    const [status, operation] = await Promise.all([
      readStatus(this.session, signal),
      readInProgress(this.session.path),
    ]);
    return { ...status, ...operation };
  }

  async readDiff(change: GitOrdinaryChange, signal?: AbortSignal) {
    await this.session.verify(signal);
    return readDiff(this.session, change, signal);
  }

  async readDiffs(changes: readonly GitOrdinaryChange[], signal?: AbortSignal) {
    await this.session.verify(signal);
    return readDiffs(this.session, changes, signal);
  }

  async readSubmoduleHeads(paths: readonly string[], signal?: AbortSignal) {
    await this.session.verify(signal);
    return readSubmoduleHeads(this.session, paths, signal);
  }

  async readBranchDetails(
    branch: string | null,
    headOid: string | null,
    signal?: AbortSignal,
  ): Promise<GitBranchDetails> {
    await this.session.verify(signal);
    const checkout = this.session.path;
    const tracking = branch
      ? await readBranchTracking(checkout, branch, signal)
      : undefined;
    const stashes = await readStashes(checkout, signal);
    const headCommit = headOid
      ? await readHeadCommit(checkout, headOid, signal)
      : null;
    const upstreamOid =
      tracking?.remoteName && tracking.upstream
        ? await readUpstreamOid(checkout, tracking.upstream, signal)
        : null;
    return {
      remoteName: tracking?.remoteName ?? null,
      sourceRef: tracking?.sourceRef ?? null,
      upstreamOid,
      stashes,
      discarded: await readDiscarded(checkout, signal),
      headCommit,
    };
  }

  async readHeadBlob(
    request: HeadBlobRequest,
    signal?: AbortSignal,
  ): Promise<HeadBlob> {
    await this.session.verify(signal);
    return readHeadBlob(this.session, request, signal);
  }
}
