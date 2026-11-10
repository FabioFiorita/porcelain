import { Effect, Layer } from 'effect';
import {
  captureGitPlatform,
  listWorktrees,
  readBranchTracking,
} from '@porcelain/git/discovery';
import { cleanupWorktree } from '@porcelain/git/actions';
import { BranchArchiver } from '@porcelain/projects/ports';
import { BranchArchiveRefusedError } from '@porcelain/projects/errors';
import { githubRepository } from '@porcelain/reviews/rules';
import type { Limits } from '../../config/limits.ts';

function repositoryKey(url: string) {
  const repository = githubRepository(url);
  return repository
    ? `${repository.owner}/${repository.repo}`.toLowerCase()
    : url;
}

export const gitBranchArchiverLayer = (limits: Limits['git']) =>
  Layer.effect(
    BranchArchiver,
    Effect.gen(function* () {
      const provideGit = yield* captureGitPlatform();
      return {
        execute: Effect.fn('BranchArchiver.execute')(function* (input) {
          return yield* Effect.gen(function* () {
            const repository = yield* listWorktrees(
              input.commonDirectory,
              limits,
            );
            const main = repository.worktrees.some(
              (tree) =>
                tree.main && tree.branch === `refs/heads/${input.branch}`,
            );
            const deleting = Object.values(input.options).some(Boolean);
            let association;
            if (deleting && !main) {
              const tracking = yield* readBranchTracking(
                input.commonDirectory,
                input.branch,
                limits,
              );
              const expected = input.pullRequestHead.repository;
              if (
                !expected ||
                !tracking.remoteName ||
                tracking.remoteName === '.' ||
                tracking.remoteRef !== `refs/heads/${input.branch}` ||
                tracking.fetchUrls.length !== 1 ||
                tracking.pushUrls.length !== 1 ||
                [...tracking.fetchUrls, ...tracking.pushUrls].some(
                  (url) => repositoryKey(url) !== repositoryKey(expected),
                )
              )
                return yield* new BranchArchiveRefusedError({
                  message:
                    'This local branch could not be associated with the pull request head repository and upstream. Nothing was deleted. Check its tracking branch and refresh the pull request.',
                });
              association = { tracking, headOid: input.pullRequestHead.oid };
            }
            return yield* cleanupWorktree({ ...input, association }, limits);
          }).pipe(
            provideGit,
            Effect.mapError((error) =>
              error._tag === 'BranchArchiveRefusedError'
                ? error
                : new BranchArchiveRefusedError({
                    message:
                      error._tag === 'GitCleanupRefusedError'
                        ? error.message
                        : 'Could not inspect the worktree and branches. Nothing was deleted. Check repository access and try again.',
                  }),
            ),
          );
        }),
      };
    }),
  );
