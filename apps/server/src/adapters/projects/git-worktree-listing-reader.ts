import { type Duration, Effect, Layer, Semaphore } from 'effect';
import { ChildProcessSpawner } from 'effect/process';
import { listWorktrees } from '@porcelain/git/discovery';
import { isRepositoryUnavailable } from '@porcelain/git/errors';
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
      const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
      const logger = yield* Logger;
      const sharedReads = yield* makeSharedReads<WorktreeListing>();
      const launches = yield* Semaphore.make(options.launches);
      const listNow = Effect.fn('GitWorktreeListingReader.listNow')(function* (
        project: ListableProject,
      ): Effect.fn.Return<WorktreeListing> {
        const repository = yield* listWorktrees(
          project.commonDirectory,
          options.git,
        ).pipe(
          Effect.provideService(
            ChildProcessSpawner.ChildProcessSpawner,
            spawner,
          ),
          Effect.timeout(options.timeout),
          Effect.catch((failure) =>
            Effect.sync(() => {
              if (!isRepositoryUnavailable(failure))
                logger.failure({
                  kind: 'worktree-listing',
                  projectId: project.id,
                  error: failure,
                });
              return undefined;
            }),
          ),
        );
        if (!repository) return { kind: 'unavailable', projectId: project.id };
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
