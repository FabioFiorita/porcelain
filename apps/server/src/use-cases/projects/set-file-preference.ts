import type {
  SetFilePreferenceParams,
  SetFilePreferenceRequest,
  SetFilePreferenceResponse,
} from '@porcelain/contracts/projects';
import type {
  CheckProjectService,
  SetFilePreferenceService,
} from '@porcelain/projects/services';
import type { EventPublisher } from '../../ports/event-publisher.ts';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../ports/operation-context.ts';

export class SetFilePreferenceUseCase {
  private readonly checkProject: CheckProjectService;
  private readonly setFilePreference: SetFilePreferenceService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;
  private readonly events: EventPublisher;

  constructor(
    checkProject: CheckProjectService,
    setFilePreference: SetFilePreferenceService,
    lanes: Lanes,
    laneKeys: LaneKeys,
    events: EventPublisher,
  ) {
    this.checkProject = checkProject;
    this.setFilePreference = setFilePreference;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
    this.events = events;
  }

  async execute(
    input: SetFilePreferenceParams & SetFilePreferenceRequest,
    context: OperationContext,
  ): Promise<SetFilePreferenceResponse> {
    const project = this.checkProject.execute({ projectId: input.projectId });
    const result = await this.lanes.run(
      this.laneKeys.project(project),
      'write',
      async () => this.setFilePreference.execute(input),
      { callerSignal: context.signal },
    );
    if (result.changed)
      this.events.projectChanged({
        projectId: input.projectId,
        change: 'preferences',
      });
    return { preferences: result.preferences };
  }
}
