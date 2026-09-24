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
import type { OperationContext } from '../../ports/operation-context.ts';

export class ReadReviewEvidenceUseCase {
  private readonly readWorktreeStatus: ReadWorktreeStatusService;
  private readonly readChangeFingerprints: ReadChangeFingerprintsService;
  private readonly readTextFiles: ReadTextFilesService;
  private readonly readChangeDiffs: ReadChangeDiffsService;

  constructor(
    readWorktreeStatus: ReadWorktreeStatusService,
    readChangeFingerprints: ReadChangeFingerprintsService,
    readTextFiles: ReadTextFilesService,
    readChangeDiffs: ReadChangeDiffsService,
  ) {
    this.readWorktreeStatus = readWorktreeStatus;
    this.readChangeFingerprints = readChangeFingerprints;
    this.readTextFiles = readTextFiles;
    this.readChangeDiffs = readChangeDiffs;
  }

  async execute(
    input: ReadReviewEvidenceInput,
    context: OperationContext,
  ): Promise<ReviewEvidence> {
    const { worktreeId } = input;
    const status = await this.readWorktreeStatus.execute(
      { worktreeId },
      context.signal,
    );
    const { changes } = await this.readChangeFingerprints.execute(
      { worktreeId, comparisons: status.changes, paths: undefined },
      context.signal,
    );
    const { texts } = await this.readTextFiles.execute(
      { worktreeId, paths: reviewPaths(input.layers, changes) },
      context.signal,
    );
    const diffs = await this.readChangeDiffs.execute(
      { worktreeId, comparisons: trackedComparisons(changes) },
      context.signal,
    );
    return { changes, texts, diffs };
  }
}
