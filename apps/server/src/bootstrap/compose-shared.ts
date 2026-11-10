import { GitActionReceiptStore } from '@porcelain/git-actions/ports';
import {
  ChangeStatusReader,
  ReadChangeFingerprintsOptions,
  BranchRangeReader,
} from '@porcelain/changes/ports';
import { ReviewedFileStore } from '@porcelain/reviews/ports';
import {
  FileReader,
  ReadTextFileOptions,
  ReadTextFilesOptions,
  ReadBinaryFilesOptions,
} from '@porcelain/files/ports';
import { Context, Effect, Layer, Clock } from 'effect';
import {
  EnvironmentIdentityReader,
  EnvironmentLabelStore,
  HostNameReader,
} from '@porcelain/access/ports';
import {
  ReadEnvironmentLabelService,
  ReadEnvironmentService,
} from '@porcelain/access/services';
import { osHostNameReaderLayer } from '../adapters/access/os-host-name-reader.ts';
import {
  ReadBranchChangesService,
  ReadChangeDiffsService,
  ReadChangeFingerprintsService,
  ReadWorktreeStatusService,
} from '@porcelain/changes/services';
import { ReadInterruptedGitActionService } from '@porcelain/git-actions/services';
import {
  WorktreeCatalogStore,
  InventoryStore,
  CheckWorktreeOptions,
  WorktreePresenceStore,
} from '@porcelain/projects/ports';
import {
  CheckRefreshedWorktreeService,
  CheckWorktreeService,
  ConfirmWorktreeService,
  ListKnownWorktreesService,
  ListRecordedWorktreesService,
  ListRegisteredProjectsService,
} from '@porcelain/projects/services';
import { InvalidateReviewedMarksService } from '@porcelain/reviews/services';
import { gitBranchRangeReaderLayer } from '../adapters/changes/git-branch-range-reader.ts';
import { gitChangeDiffReaderLayer } from '../adapters/changes/git-change-diff-reader.ts';
import { gitChangeStatusReaderLayer } from '../adapters/changes/git-change-status-reader.ts';
import { gitWorktreeSideReaderLayer } from '../adapters/changes/git-worktree-side-reader.ts';
import { inspectionCheckouts } from '../adapters/changes/inspection-checkouts.ts';
import {
  ReadBinaryFilesService,
  ReadTextFileService,
  ReadTextFilesService,
} from '@porcelain/files/services';
import { filesystemFileReaderLayer } from '../adapters/files/filesystem-file-reader.ts';
import { gitHeadTextReaderLayer } from '../adapters/files/git-head-text-reader.ts';
import { gitWorktreeAccessReaderLayer } from '../adapters/projects/git-worktree-access-reader.ts';
import { ListedWorktreeAccessReader } from '@porcelain/projects/ports';
import { type ServerSettings } from '../config/server-settings.ts';
import { type Stores } from './compose-stores.ts';

export type Shared = Effect.Success<ReturnType<typeof composeShared>>;

type SharedDependencies = {
  settings: ServerSettings;
  stores: Stores;
  catalog: WorktreeCatalogStore;
  gitVersion: Buffer;
  clock: Clock.Clock;
};

export function composeShared(dependencies: SharedDependencies) {
  return Effect.gen(function* () {
    const { stores, catalog, gitVersion } = dependencies;
    const { limits } = dependencies.settings;
    const accessContext = yield* Layer.build(
      gitWorktreeAccessReaderLayer.pipe(
        Layer.provide(Layer.succeed(WorktreeCatalogStore, catalog)),
      ),
    );
    const worktreeAccess = Context.get(
      accessContext,
      ListedWorktreeAccessReader,
    );
    const staleness = { staleAfterMs: limits.inventory.staleAfterMs };
    const openInspection = inspectionCheckouts(worktreeAccess, limits.git);
    const ports = Layer.mergeAll(
      filesystemFileReaderLayer(worktreeAccess),
      gitHeadTextReaderLayer(openInspection),
      Layer.succeed(ReadTextFileOptions, limits.files.readTextFile),
      Layer.succeed(ReadTextFilesOptions, limits.files.readTextFile),
      gitChangeStatusReaderLayer(openInspection),
      gitWorktreeSideReaderLayer(openInspection, limits.changes.worktreeReads),
      Layer.succeed(ReadChangeFingerprintsOptions, limits.changes.fingerprints),
      gitChangeDiffReaderLayer(openInspection),
      Layer.succeed(WorktreeCatalogStore, catalog),
      Layer.succeed(InventoryStore, stores.inventory),
      Layer.succeed(Clock.Clock, dependencies.clock),
      Layer.succeed(CheckWorktreeOptions, staleness),
      gitBranchRangeReaderLayer(worktreeAccess, gitVersion, limits.git),
      Layer.succeed(GitActionReceiptStore, stores.gitActions),
      Layer.succeed(WorktreePresenceStore, stores.worktreePresence),
      Layer.succeed(ReadBinaryFilesOptions, limits.reviews.proof),
      Layer.succeed(ReviewedFileStore, stores.reviewedFiles),
    );
    const native = Layer.mergeAll(
      ReadEnvironmentService.layer,
      ReadEnvironmentLabelService.layer,
    )
      .pipe(
        Layer.provideMerge(
          Layer.mergeAll(
            Layer.succeed(
              EnvironmentIdentityReader,
              dependencies.stores.environmentIdentity,
            ),
            Layer.succeed(
              EnvironmentLabelStore,
              dependencies.stores.environmentLabel,
            ),
            osHostNameReaderLayer,
          ),
        ),
      )
      .pipe(Layer.provideMerge(ports));
    const services = Layer.mergeAll(
      ReadTextFileService.layer,
      ReadTextFilesService.layer,
      ReadWorktreeStatusService.layer,
      ReadChangeFingerprintsService.layer,
      ReadChangeDiffsService.layer,
      CheckWorktreeService.layer,
      ConfirmWorktreeService.layer,
      CheckRefreshedWorktreeService.layer,
      ReadBranchChangesService.layer,
      ReadInterruptedGitActionService.layer,
      ListRegisteredProjectsService.layer,
      ListKnownWorktreesService.layer,
      ListRecordedWorktreesService.layer,
      ReadBinaryFilesService.layer,
      InvalidateReviewedMarksService.layer,
    ).pipe(Layer.provideMerge(native));
    const runtime = yield* Layer.build(services);
    return yield* Effect.gen(function* () {
      return {
        gitVersion,
        catalog,
        worktreeAccess,
        openInspection,
        changeStatusReader: yield* ChangeStatusReader,
        fileReader: yield* FileReader,
        checkWorktreeService: yield* CheckWorktreeService,
        confirmWorktree: yield* ConfirmWorktreeService,
        checkRefreshedWorktree: yield* CheckRefreshedWorktreeService,
        readEnvironment: yield* ReadEnvironmentService,
        readEnvironmentLabel: yield* ReadEnvironmentLabelService,
        hostNames: yield* HostNameReader,
        readTextFileService: yield* ReadTextFileService,
        readWorktreeStatus: yield* ReadWorktreeStatusService,
        readChangeFingerprints: yield* ReadChangeFingerprintsService,
        branchRangeReader: yield* BranchRangeReader,
        readBranchChanges: yield* ReadBranchChangesService,
        readChangeDiffs: yield* ReadChangeDiffsService,
        readInterruptedGitAction: yield* ReadInterruptedGitActionService,
        listRegisteredProjects: yield* ListRegisteredProjectsService,
        listKnownWorktrees: yield* ListKnownWorktreesService,
        listRecordedWorktrees: yield* ListRecordedWorktreesService,
        readTextFilesService: yield* ReadTextFilesService,
        readBinaryFiles: yield* ReadBinaryFilesService,
        invalidateReviewedMarks: yield* InvalidateReviewedMarksService,
      };
    }).pipe(Effect.provideContext(runtime));
  });
}
