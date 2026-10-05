import { Cause, Duration, Effect, Exit, type Semaphore } from 'effect';
import { nativeOperation } from '@porcelain/effects';
import type { DiscoveryResult, GitFactory } from '@porcelain/git/discovery';
import { isRepositoryUnavailable } from '@porcelain/git/errors';
import type {
  ListableProject,
  ListedWorktree,
  WorktreeListing,
} from '@porcelain/projects/models';
import type { WorktreeListingReader } from '@porcelain/projects/ports';
import type { Logger } from '../../ports/logger.ts';
import type { SharedReads } from '../../runtime/shared-reads.ts';

type WorktreeListingOptions = {
  git: GitFactory;
  sharedReads: Pick<SharedReads<WorktreeListing>, 'run'>;
  launches: Semaphore.Semaphore;
  timeoutMs: number;
  worktreeId: (projectId: string, metadataIdentity: string) => string;
  logger: Logger;
};

export class GitWorktreeListingReader implements WorktreeListingReader {
  private readonly options: WorktreeListingOptions;

  constructor(options: WorktreeListingOptions) {
    this.options = options;
  }

  list(input: ListableProject): Effect.Effect<WorktreeListing> {
    return this.options.sharedReads.run(
      `worktrees\0${input.id}\0${input.commonDirectory}`,
      () => this.options.launches.withPermit(this.listNow(input)),
    );
  }

  private listNow(project: ListableProject): Effect.Effect<WorktreeListing> {
    return Effect.gen({ self: this }, function* () {
      const exit = yield* Effect.exit(
        nativeOperation((signal) =>
          this.options.git(project.commonDirectory).listWorktrees(signal),
        ).pipe(
          Effect.timeoutOrElse({
            duration: Duration.millis(this.options.timeoutMs),
            orElse: () =>
              Effect.die(
                new DOMException(
                  'The worktree listing exceeded its deadline',
                  'TimeoutError',
                ),
              ),
          }),
        ),
      );
      if (Exit.isFailure(exit)) {
        if (Cause.hasInterruptsOnly(exit.cause))
          return yield* Effect.failCause(exit.cause);
        const failure = Cause.squash(exit.cause);
        if (!isRepositoryUnavailable(failure))
          this.options.logger.failure({
            kind: 'worktree-listing',
            projectId: project.id,
            error: failure,
          });
        return { kind: 'unavailable', projectId: project.id };
      }
      const discovered: DiscoveryResult = exit.value;
      const { repository } = discovered;
      const worktrees: ListedWorktree[] = [];
      let unidentified = 0;
      for (const worktree of repository.worktrees) {
        if (!worktree.metadataIdentity) {
          unidentified += 1;
          continue;
        }
        worktrees.push({
          id: this.options.worktreeId(project.id, worktree.metadataIdentity),
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
  }
}
