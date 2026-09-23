import type {
  EditFileRequest,
  EditFileResponse,
} from '@porcelain/contracts/files';
import type { WorktreeParams } from '@porcelain/contracts/shared';
import type {
  CheckWorktreeService,
  EditFileService,
} from '@porcelain/files/services';
import type { EventPublisher } from '../runtime/event-publisher.ts';
import type { LaneKeys } from '../runtime/lane-keys.ts';
import type { Lanes } from '../runtime/lanes.ts';
import type { OperationContext } from '../runtime/operation-context.ts';

export class EditFileController {
  private readonly checkWorktree: CheckWorktreeService;
  private readonly editFile: EditFileService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;
  private readonly events: EventPublisher;

  constructor(
    checkWorktree: CheckWorktreeService,
    editFile: EditFileService,
    lanes: Lanes,
    laneKeys: LaneKeys,
    events: EventPublisher,
  ) {
    this.checkWorktree = checkWorktree;
    this.editFile = editFile;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
    this.events = events;
  }

  execute(
    input: WorktreeParams & { command: EditFileRequest },
    context: OperationContext,
  ): Promise<EditFileResponse> {
    const check = { worktreeId: input.worktreeId, purpose: 'writing' } as const;
    return this.lanes.run(
      this.laneKeys.worktree(input.worktreeId),
      'write',
      async ({ signal }) => {
        await this.checkWorktree.execute(check, signal);
        const result = await this.editFile.execute(input, signal);
        await this.checkWorktree.execute(check, signal);
        this.events.filesChanged(
          input.worktreeId,
          input.command.kind === 'move'
            ? [input.command.path, input.command.destination]
            : [input.command.path],
        );
        return result;
      },
      { callerSignal: context.signal },
    );
  }
}
