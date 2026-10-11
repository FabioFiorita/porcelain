import { type Duration, Effect, Layer, Semaphore } from 'effect';
import { captureGitPlatform } from '@porcelain/git/discovery';
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
            Effect.sync(() => {
              const reason =
                repositoryUnavailableReason(failure) ?? 'git-failed';
              if (reason === 'git-failed')
                logger.failure({
                  kind: 'worktree-listing',
                  projectId: project.id,
                  reason,
                  error: failure,
                });
              return {
                kind: 'unavailable' as const,
                projectId: project.id,
                reason,
              };
            }),
          ),
        );
        if (result.kind === 'unavailable') return result;
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
