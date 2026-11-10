import { Context, Effect, Layer, Clock } from 'effect';
import type { ghPullRequestReaderLayer } from '../adapters/reviews/gh-pull-request-reader.ts';
import { gitProjectRepositoryReaderLayer } from '../adapters/projects/git-project-repository-reader.ts';
import { gitBranchArchiverLayer } from '../adapters/projects/git-branch-archiver.ts';
import { CacheWalkthroughPullTitlesService } from '@porcelain/walkthroughs/services';
import { WalkthroughStore } from '@porcelain/walkthroughs/ports';
import {
  GitHubAccountStore,
  ReviewedFileStore,
  SetReviewedFilesOptions,
} from '@porcelain/reviews/ports';
import {
  SelectGitHubAccountService,
  GitHubAccountPreferenceService,
  ReadGitHubPullRequestService,
  ReadGitHubPullChecksService,
  ListGitHubPullRequestsService,
  SetReviewedFilesService,
  ListReviewedFilesService,
  RemoveReviewedFilesService,
  InvalidateReviewedMarksService,
} from '@porcelain/reviews/services';
import {
  ArchiveBranchService,
  CheckProjectService,
  ReadRepositoryOriginService,
  ListKnownWorktreesService,
} from '@porcelain/projects/services';
import { InventoryStore } from '@porcelain/projects/ports';
import {
  ReadWorktreeStatusService,
  ReadChangeFingerprintsService,
  ReadBranchChangesService,
} from '@porcelain/changes/services';
import { CheckWorktreeUseCasePort } from '../ports/check-worktree-use-case-port.ts';
import { WorktreeConsistencyProbe } from '../ports/worktree-consistency-probe.ts';
import { EventPublisher } from '../ports/event-publisher.ts';
import { InventoryScan } from '../ports/inventory-scan.ts';
import { Lanes } from '../runtime/lanes.ts';
import { LaneKeys } from '../runtime/lane-keys.ts';
import { WorktreeAccess } from '../runtime/worktree-access.ts';
import { ResolveProjectGitHubUseCasePort } from '../ports/resolve-project-github-use-case-port.ts';
import { ReadProjectGitHubTargetUseCasePort } from '../ports/read-project-github-target-use-case-port.ts';
import { ReadProjectPullRequestUseCasePort } from '../ports/read-project-pull-request-use-case-port.ts';
import { ResolveProjectGitHubUseCase } from '../use-cases/reviews/resolve-project-github.ts';
import { ReadProjectGitHubTargetUseCase } from '../use-cases/projects/read-project-github-target.ts';
import { ReadProjectPullRequestUseCase } from '../use-cases/projects/read-project-pull-request.ts';
import { ReadProjectPullChecksUseCase } from '../use-cases/projects/read-project-pull-checks.ts';
import { ArchivePullRequestUseCase } from '../use-cases/projects/archive-pull-request.ts';
import { ReadProjectGitHubAccountUseCase } from '../use-cases/reviews/read-project-github-account.ts';
import { ListProjectPullRequestsUseCase } from '../use-cases/reviews/list-project-pull-requests.ts';
import { ListReviewedFilesUseCase } from '../use-cases/reviews/list-reviewed-files.ts';
import { SetReviewedFilesUseCase } from '../use-cases/reviews/set-reviewed-files.ts';
import { RemoveReviewedFilesUseCase } from '../use-cases/reviews/remove-reviewed-files.ts';
import { InvalidateReviewedMarksUseCase } from '../use-cases/reviews/invalidate-reviewed-marks.ts';
import { reviewedFilesRoutes } from '../http/routes/changes/reviewed-api.ts';
import { pullRequestsRoutes } from '../http/routes/projects/pull-requests-api.ts';
import type { ComposeContext } from './compose-context.ts';
import type { Shared } from './compose-shared.ts';
import type { Stores } from './compose-stores.ts';

type Dependencies = {
  githubReader: typeof ghPullRequestReaderLayer;
  stores: Stores;
  shared: Shared;
  checkWorktree: CheckWorktreeUseCasePort;
  inventory: Context.Service.Shape<typeof InventoryScan>;
};
export function composeReviews(
  context: ComposeContext,
  dependencies: Dependencies,
) {
  const { stores, shared } = dependencies;
  const ports = Layer.mergeAll(
    dependencies.githubReader(context.settings.limits.git),
    gitBranchArchiverLayer(context.settings.limits.git),
    ReadRepositoryOriginService.layer.pipe(
      Layer.provide(
        gitProjectRepositoryReaderLayer(context.settings.limits.git),
      ),
    ),
    Layer.succeed(WalkthroughStore, stores.walkthroughs),
    Layer.succeed(GitHubAccountStore, stores.githubAccounts),
    Layer.succeed(InventoryStore, stores.inventory),
    Layer.succeed(ReviewedFileStore, stores.reviewedFiles),
    Layer.succeed(
      SetReviewedFilesOptions,
      context.settings.limits.reviews.reviewedFiles,
    ),
    Layer.succeed(CheckWorktreeUseCasePort, dependencies.checkWorktree),
    Layer.succeed(WorktreeConsistencyProbe, shared.confirmWorktree),
    Layer.succeed(Lanes, context.lanes),
    Layer.succeed(LaneKeys, context.laneKeys),
    Layer.succeed(Clock.Clock, context.clock),
    Layer.succeed(EventPublisher, context.events),
    Layer.succeed(InventoryScan, dependencies.inventory),
    Layer.succeed(ListKnownWorktreesService, shared.listKnownWorktrees),
    Layer.succeed(
      InvalidateReviewedMarksService,
      shared.invalidateReviewedMarks,
    ),
    Layer.succeed(ReadWorktreeStatusService, shared.readWorktreeStatus),
    Layer.succeed(ReadChangeFingerprintsService, shared.readChangeFingerprints),
    Layer.succeed(ReadBranchChangesService, shared.readBranchChanges),
  );
  const services = Layer.mergeAll(
    SelectGitHubAccountService.layer,
    GitHubAccountPreferenceService.layer,
    ReadGitHubPullRequestService.layer,
    ReadGitHubPullChecksService.layer,
    ListGitHubPullRequestsService.layer,
    CacheWalkthroughPullTitlesService.layer,
    CheckProjectService.layer,
    WorktreeAccess.layer,
    ArchiveBranchService.layer,
    SetReviewedFilesService.layer,
    ListReviewedFilesService.layer,
    RemoveReviewedFilesService.layer,
  ).pipe(Layer.provideMerge(ports));
  const resolve = ResolveProjectGitHubUseCase.layer.pipe(
    Layer.provideMerge(services),
  );
  const resolution = Layer.effect(
    ResolveProjectGitHubUseCasePort,
    ResolveProjectGitHubUseCase,
  ).pipe(Layer.provideMerge(resolve));
  const target = ReadProjectGitHubTargetUseCase.layer.pipe(
    Layer.provideMerge(resolution),
  );
  const targets = Layer.effect(
    ReadProjectGitHubTargetUseCasePort,
    ReadProjectGitHubTargetUseCase,
  ).pipe(Layer.provideMerge(target));
  const operations = Layer.mergeAll(
    ReadProjectPullRequestUseCase.layer,
    ReadProjectPullChecksUseCase.layer,
    ReadProjectGitHubAccountUseCase.layer,
    ListProjectPullRequestsUseCase.layer,
    ListReviewedFilesUseCase.layer,
    SetReviewedFilesUseCase.layer,
    RemoveReviewedFilesUseCase.layer,
    InvalidateReviewedMarksUseCase.layer,
  ).pipe(Layer.provideMerge(targets));
  const readPull = Layer.effect(
    ReadProjectPullRequestUseCasePort,
    ReadProjectPullRequestUseCase,
  ).pipe(Layer.provideMerge(operations));
  const application = ArchivePullRequestUseCase.layer.pipe(
    Layer.provideMerge(readPull),
  );
  return Effect.gen(function* () {
    const runtime = yield* Layer.build(application);
    const useCases = {
      readProjectPullRequest: Context.get(
        runtime,
        ReadProjectPullRequestUseCase,
      ),
      readProjectPullChecks: Context.get(runtime, ReadProjectPullChecksUseCase),
      archivePullRequest: Context.get(runtime, ArchivePullRequestUseCase),
      readProjectGitHubAccount: Context.get(
        runtime,
        ReadProjectGitHubAccountUseCase,
      ),
      listProjectPullRequests: Context.get(
        runtime,
        ListProjectPullRequestsUseCase,
      ),
      listReviewedFiles: Context.get(runtime, ListReviewedFilesUseCase),
      setReviewedFiles: Context.get(runtime, SetReviewedFilesUseCase),
      removeReviewedFiles: Context.get(runtime, RemoveReviewedFilesUseCase),
      invalidateReviewedMarks: Context.get(
        runtime,
        InvalidateReviewedMarksUseCase,
      ),
    };
    return {
      ...useCases,
      resolveProjectGitHub: Context.get(
        runtime,
        ResolveProjectGitHubUseCasePort,
      ),
      routes: Layer.mergeAll(
        reviewedFilesRoutes(useCases),
        pullRequestsRoutes(useCases),
      ),
    };
  });
}
