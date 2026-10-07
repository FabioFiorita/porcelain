import { Effect, Layer } from 'effect';
import { readGitEffect } from '../../runtime/git-io.ts';
import { captureGitPlatform } from '@porcelain/git/discovery';
import { HistorySnapshotUnavailableError } from '@porcelain/git/errors';
import { makeGitSession } from '@porcelain/git/inspection';
import type { Limits } from '../../config/limits.ts';
import {
  type CommitFilesLookup,
  type CommitPage,
  type CommitPatches,
  type CommitPatchesRequest,
  type CommitSummary,
  type FileCommits,
  type ListCommitsInput,
  type ListFileCommitsInput,
  type ReadCommitFilesInput,
} from '@porcelain/changes/models';
import { CommitHistoryReader } from '@porcelain/changes/ports';
import { type CommitSummary as GitCommitSummary } from '@porcelain/git/history';
import {
  openCheckoutEffect,
  type ListedWorktrees,
} from '../projects/checkout-session.ts';

import * as history from '@porcelain/git/history';

export const gitCommitHistoryReaderLayer = (
  worktrees: ListedWorktrees,
  gitVersion: Buffer,
  limits: Limits['git'],
) =>
  Layer.effect(
    CommitHistoryReader,
    Effect.gen(function* () {
      const provideGit = yield* captureGitPlatform();
      const listCommitsNative = Effect.fn(
        'CommitHistoryReader.listCommitsNative',
      )(function* (input: ListCommitsInput) {
        const session = yield* makeGitSession(limits);
        const { worktree, checkout } = yield* openCheckoutEffect(
          worktrees,
          session,
          input.worktreeId,
        );
        const historyCheckout = { ...worktree, path: checkout.path };
        const page = yield* history.listCommits(
          historyCheckout,
          gitVersion,
          {
            ...(input.limit === undefined ? {} : { limit: input.limit }),
            ...(input.after === undefined ? {} : { after: input.after }),
            ...(input.tip === undefined ? {} : { tip: input.tip }),
          },
          limits,
        );
        return {
          snapshot: page.snapshot
            ? {
                tipOid: page.snapshot.tipOid ?? undefined,
                head: page.snapshot.head,
              }
            : undefined,
          commits: page.commits.map(summary),
          nextAfter: page.nextAfter ?? undefined,
          tip: page.tip ?? undefined,
          boundary: page.boundary ?? undefined,
          restarted: page.restarted,
        } satisfies CommitPage;
      });
      const listFileCommitsNative = Effect.fn(
        'CommitHistoryReader.listFileCommitsNative',
      )(function* (input: ListFileCommitsInput) {
        const session = yield* makeGitSession(limits);
        const { worktree, checkout } = yield* openCheckoutEffect(
          worktrees,
          session,
          input.worktreeId,
        );
        const historyCheckout = { ...worktree, path: checkout.path };
        const listed = yield* history.listFileCommits(
          historyCheckout,
          gitVersion,
          {
            path: input.path,
            ...(input.limit === undefined ? {} : { limit: input.limit }),
          },
          limits,
        );
        return {
          commits: listed.commits.map((entry) => ({
            commit: summary(entry.commit),
            path: entry.path,
            previousPath: entry.previousPath ?? undefined,
            status: entry.status,
          })),
          more: listed.more,
        } satisfies FileCommits;
      });
      const readCommitFilesNative = Effect.fn(
        'CommitHistoryReader.readCommitFilesNative',
      )(function* (input: ReadCommitFilesInput) {
        const session = yield* makeGitSession(limits);
        const { worktree, checkout } = yield* openCheckoutEffect(
          worktrees,
          session,
          input.worktreeId,
        );
        const historyCheckout = { ...worktree, path: checkout.path };
        const read = yield* history
          .readCommitFiles(
            historyCheckout,
            gitVersion,
            {
              oid: input.oid,
              ...(input.parent === undefined ? {} : { parent: input.parent }),
            },
            limits,
          )
          .pipe(
            Effect.catchIf(
              (cause): cause is HistorySnapshotUnavailableError =>
                cause instanceof HistorySnapshotUnavailableError,
              () => Effect.succeed(undefined),
            ),
          );
        if (read === undefined)
          return { kind: 'missing' } satisfies CommitFilesLookup;
        return {
          kind: 'found',
          files: {
            commit: summary(read.commit),
            comparison: read.comparison,
            files: read.files.map((file) => ({
              oldPath: file.oldPath ?? undefined,
              newPath: file.newPath ?? undefined,
              status: file.status,
              oldMode: file.oldMode,
              newMode: file.newMode,
            })),
          },
        } satisfies CommitFilesLookup;
      });

      const readCommitPatchesNative = Effect.fn(
        'CommitHistoryReader.readCommitPatchesNative',
      )(function* (input: CommitPatchesRequest) {
        const session = yield* makeGitSession(limits);
        const { worktree, checkout } = yield* openCheckoutEffect(
          worktrees,
          session,
          input.worktreeId,
        );
        const historyCheckout = { ...worktree, path: checkout.path };
        const sections = yield* history.readCommitDiffs(
          historyCheckout,
          {
            oid: input.oid,
            paths: input.paths,
            ...(input.parent === undefined ? {} : { parent: input.parent }),
          },
          limits,
        );
        if (sections === null)
          return { kind: 'over-limit' } satisfies CommitPatches;
        return {
          kind: 'within-limit',
          patches: [...sections].map(([key, content]) => ({
            paths: key.split('\0'),
            content,
          })),
        } satisfies CommitPatches;
      });
      return {
        listCommits: Effect.fn('CommitHistoryReader.listCommits')((input) =>
          readGitEffect(
            input.worktreeId,
            listCommitsNative(input).pipe(provideGit),
          ),
        ),
        listFileCommits: Effect.fn('CommitHistoryReader.listFileCommits')(
          (input) =>
            readGitEffect(
              input.worktreeId,
              listFileCommitsNative(input).pipe(provideGit),
            ),
        ),
        readCommitFiles: Effect.fn('CommitHistoryReader.readCommitFiles')(
          (input) =>
            readGitEffect(
              input.worktreeId,
              readCommitFilesNative(input).pipe(provideGit),
            ),
        ),
        readCommitPatches: Effect.fn('CommitHistoryReader.readCommitPatches')(
          (input) =>
            readGitEffect(
              input.worktreeId,
              readCommitPatchesNative(input).pipe(provideGit),
            ),
        ),
      };
    }),
  );

function summary(commit: GitCommitSummary): CommitSummary {
  return {
    oid: commit.oid,
    parentOids: commit.parentOids,
    author: {
      name: commit.author.name,
      timestamp: new Date(commit.author.timestamp).toISOString(),
    },
    subject: commit.subject,
    subjectTruncated: commit.subjectTruncated,
    body: commit.body ?? undefined,
    bodyTruncated: commit.bodyTruncated,
    refs: commit.refs,
  };
}
