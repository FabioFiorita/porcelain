import { Effect } from 'effect';
import type {
  ProjectNotFoundError,
  FilePreferenceLimitError,
} from '@porcelain/projects/errors';
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

  execute(
    input: SetFilePreferenceParams & SetFilePreferenceRequest,
  ): Effect.Effect<
    SetFilePreferenceResponse,
    ProjectNotFoundError | FilePreferenceLimitError
  > {
    return Effect.gen({ self: this }, function* () {
      const project = yield* this.checkProject.execute({
        projectId: input.projectId,
      });
      const result = yield* this.lanes.run(
        this.laneKeys.project(project),
        'write',
        () => this.setFilePreference.execute(input),
      );
      if (result.changed)
        this.events.projectChanged({
          projectId: input.projectId,
          change: 'preferences',
        });
      return { preferences: result.preferences };
    });
  }
}
