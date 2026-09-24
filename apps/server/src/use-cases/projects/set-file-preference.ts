import type {
  SetFilePreferenceParams,
  SetFilePreferenceRequest,
  SetFilePreferenceResponse,
} from '@porcelain/contracts/projects';
import type { SetFilePreferenceService } from '@porcelain/projects/services';
import type { EventPublisher } from '../../ports/event-publisher.ts';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../runtime/operation-context.ts';

export class SetFilePreferenceUseCase {
  private readonly setFilePreference: SetFilePreferenceService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;
  private readonly events: EventPublisher;

  constructor(
    setFilePreference: SetFilePreferenceService,
    lanes: Lanes,
    laneKeys: LaneKeys,
    events: EventPublisher,
  ) {
    this.setFilePreference = setFilePreference;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
    this.events = events;
  }

  execute(
    input: SetFilePreferenceParams & SetFilePreferenceRequest,
    context: OperationContext,
  ): Promise<SetFilePreferenceResponse> {
    return this.lanes.run(
      this.laneKeys.project(input.projectId),
      'write',
      async () => {
        const result = this.setFilePreference.execute(input);
        this.events.projectChanged({
          projectId: input.projectId,
          change: 'preferences',
        });
        return result;
      },
      { callerSignal: context.signal },
    );
  }
}
