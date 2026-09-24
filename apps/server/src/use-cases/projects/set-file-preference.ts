import type {
  SetFilePreferenceParams,
  SetFilePreferenceRequest,
  SetFilePreferenceResponse,
} from '@porcelain/contracts/projects';
import type { SetFilePreferenceService } from '@porcelain/projects/services';
import type { EventPublisher } from '../../runtime/event-publisher.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../runtime/operation-context.ts';

export class SetFilePreferenceUseCase {
  private readonly setFilePreference: SetFilePreferenceService;
  private readonly lanes: Lanes;
  private readonly events: EventPublisher;

  constructor(
    setFilePreference: SetFilePreferenceService,
    lanes: Lanes,
    events: EventPublisher,
  ) {
    this.setFilePreference = setFilePreference;
    this.lanes = lanes;
    this.events = events;
  }

  execute(
    input: SetFilePreferenceParams & SetFilePreferenceRequest,
    context: OperationContext,
  ): Promise<SetFilePreferenceResponse> {
    return this.lanes.unqueued(
      async () => {
        const result = this.setFilePreference.execute(input);
        this.events.projectChanged(input.projectId, 'preferences');
        return result;
      },
      { callerSignal: context.signal },
    );
  }
}
