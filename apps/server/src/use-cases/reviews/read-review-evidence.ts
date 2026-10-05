import type {
  ReadChangeDiffsService,
  ReadChangeFingerprintsService,
  ReadWorktreeStatusService,
} from '@porcelain/changes/services';
import type { ReadTextFilesService } from '@porcelain/files/services';
import type {
  ReadReviewEvidenceInput,
  ReviewEvidence,
} from '@porcelain/reviews/models';
import { reviewPaths, trackedComparisons } from '@porcelain/reviews/rules';
import { Effect } from 'effect';
import type { WorktreeRead } from '@porcelain/effects';
import type { GitIoFailure } from '../../ports/git-io-failure.ts';
import type { IncompleteDiffReadError } from '@porcelain/changes/errors';

export class ReadReviewEvidenceUseCase {
  private readonly readWorktreeStatus: ReadWorktreeStatusService<GitIoFailure>;
  private readonly readChangeFingerprints: ReadChangeFingerprintsService<GitIoFailure>;
  private readonly readTextFiles: ReadTextFilesService;
  private readonly readChangeDiffs: ReadChangeDiffsService<GitIoFailure>;

  constructor(
    readWorktreeStatus: ReadWorktreeStatusService<GitIoFailure>,
    readChangeFingerprints: ReadChangeFingerprintsService<GitIoFailure>,
    readTextFiles: ReadTextFilesService,
    readChangeDiffs: ReadChangeDiffsService<GitIoFailure>,
  ) {
    this.readWorktreeStatus = readWorktreeStatus;
    this.readChangeFingerprints = readChangeFingerprints;
    this.readTextFiles = readTextFiles;
    this.readChangeDiffs = readChangeDiffs;
  }

  execute(
    input: ReadReviewEvidenceInput,
  ): Effect.Effect<
    ReviewEvidence,
    GitIoFailure | IncompleteDiffReadError,
    WorktreeRead
  > {
    return Effect.gen({ self: this }, function* () {
      const { worktreeId } = input;
      const status = yield* this.readWorktreeStatus.execute({ worktreeId });
      const { changes } = yield* this.readChangeFingerprints.execute({
        worktreeId,
        comparisons: status.changes,
        paths: undefined,
      });
      const { texts } = yield* this.readTextFiles.execute({
        worktreeId,
        paths: reviewPaths(input.layers, changes),
      });
      const diffs = yield* this.readChangeDiffs.execute({
        worktreeId,
        comparisons: trackedComparisons(changes),
      });
      return { changes, texts, diffs };
    });
  }
}
