import type {
  ReadProofFileQuery,
  ReadProofFileResponse,
} from '@porcelain/contracts/reviews';
import type { WorktreeParams } from '@porcelain/contracts/shared';
import type { ReadProofFileService } from '@porcelain/reviews/services';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../ports/operation-context.ts';
import type { CheckWorktreeUseCasePort } from '../../ports/check-worktree-use-case-port.ts';

export class ReadProofFileUseCase {
  private readonly checkWorktree: CheckWorktreeUseCasePort;
  private readonly readProofFile: ReadProofFileService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;

  constructor(
    checkWorktree: CheckWorktreeUseCasePort,
    readProofFile: ReadProofFileService,
    lanes: Lanes,
    laneKeys: LaneKeys,
  ) {
    this.checkWorktree = checkWorktree;
    this.readProofFile = readProofFile;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
  }

  async execute(
    input: WorktreeParams & ReadProofFileQuery,
    context: OperationContext,
  ): Promise<ReadProofFileResponse> {
    const { worktreeId, proofId } = input;
    const worktree = await this.checkWorktree.execute(
      { worktreeId, requireAvailableProject: false },
      context,
    );
    return this.lanes.run(
      this.laneKeys.reviews(worktree),
      'read',
      async () => this.readProofFile.execute({ worktreeId, proofId }),
      { callerSignal: context.signal },
    );
  }
}
