import {
  type Duration,
  Effect,
  FileSystem,
  Layer,
  Path,
  Semaphore,
} from 'effect';
import { captureGitPlatform, identity } from '@porcelain/git/discovery';
import { listWorktrees } from '@porcelain/git/discovery';
import { repositoryUnavailableReason } from '@porcelain/git/errors';
import type {
  ListableProject,
  ListedWorktree,
  WorktreeListing,
} from '@porcelain/projects/models';
import { WorktreeListingReader } from '@porcelain/projects/ports';
import type { Limits } from '../../config/limits.ts';
import { Logger } from '../../ports/logger.ts';
import { makeSharedReads } from '../../runtime/shared-reads.ts';

type WorktreeListingOptions = {
  git: Limits['git'];
  launches: number;
  timeout: Duration.Duration;
  worktreeId: (projectId: string, metadataIdentity: string) => string;
};

export const gitWorktreeListingReaderLayer = (
  options: WorktreeListingOptions,
) =>
  Layer.effect(
    WorktreeListingReader,
    Effect.gen(function* () {
      const provideGit = yield* captureGitPlatform();
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const logger = yield* Logger;
      const sharedReads = yield* makeSharedReads<WorktreeListing>();
      const launches = yield* Semaphore.make(options.launches);
      const listNow = Effect.fn('GitWorktreeListingReader.listNow')(function* (
        project: ListableProject,
      ): Effect.fn.Return<WorktreeListing> {
        const result = yield* listWorktrees(
          project.commonDirectory,
          options.git,
        ).pipe(
          provideGit,
          Effect.timeout(options.timeout),
          Effect.map((repository) => ({ kind: 'listed' as const, repository })),
          Effect.catch((failure) =>
            Effect.gen(function* () {
              const currentIdentity = yield* identity(
                project.commonDirectory,
              ).pipe(Effect.result);
              if (currentIdentity._tag === 'Failure')
                return {
                  kind: 'unavailable' as const,
                  projectId: project.id,
                  reason:
                    repositoryUnavailableReason(currentIdentity.failure) ??
                    'git-failed',
                };
              const headFailure = yield* fs
                .access(path.join(project.commonDirectory, 'HEAD'), {
                  readable: true,
                })
                .pipe(Effect.result);
              if (headFailure._tag === 'Failure')
                return {
                  kind: 'unavailable' as const,
                  projectId: project.id,
                  reason:
                    repositoryUnavailableReason(headFailure.failure) ===
                    'permission'
                      ? ('permission' as const)
                      : ('git-failed' as const),
                };
              if (failure._tag === 'UnsupportedRepositoryError')
                return {
                  kind: 'unavailable' as const,
                  projectId: project.id,
                  reason: 'git-failed' as const,
                };
              if (repositoryUnavailableReason(failure) === undefined)
                logger.failure({
                  kind: 'worktree-listing',
                  projectId: project.id,
                  reason: 'git-failed',
                  error: failure,
                });
              return {
                kind: 'inconclusive' as const,
                projectId: project.id,
                repositoryIdentity: currentIdentity.success,
              };
            }),
          ),
        );
        if (result.kind !== 'listed') return result;
        const { repository } = result;
        const worktrees: ListedWorktree[] = [];
        let unidentified = 0;
        for (const worktree of repository.worktrees) {
          if (!worktree.metadataIdentity) {
            unidentified += 1;
            continue;
          }
          worktrees.push({
            id: options.worktreeId(project.id, worktree.metadataIdentity),
            projectId: project.id,
            path: worktree.path,
            branch: worktree.branch ?? undefined,
            ...(worktree.headCommittedAt
              ? { headCommittedAt: worktree.headCommittedAt }
              : {}),
            main: worktree.main,
            available: worktree.available,
            metadataIdentity: worktree.metadataIdentity,
            administrativeDirectory: worktree.administrativeDirectory,
            commonDirectory: repository.commonDirectory,
            repositoryIdentity: repository.repositoryIdentity,
            repositoryId: repository.repositoryIdentity,
          });
        }
        return {
          kind: 'listed',
          projectId: project.id,
          repositoryIdentity: repository.repositoryIdentity,
          worktrees,
          unidentified,
        };
      });
      return {
        list: (input: ListableProject) =>
          sharedReads.run(
            `worktrees\0${input.id}\0${input.commonDirectory}`,
            () => launches.withPermit(listNow(input)),
          ),
      };
    }),
  );
