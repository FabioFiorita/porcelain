import { Effect, Context, Layer } from 'effect';
import {
  type ProjectNotFoundError,
  type FilePreferenceLimitError,
} from '@porcelain/projects/errors';
import {
  type SetFilePreferenceParams,
  type SetFilePreferenceRequest,
  type SetFilePreferenceResponse,
} from '@porcelain/contracts/projects';
import {
  CheckProjectService,
  SetFilePreferenceService,
} from '@porcelain/projects/services';
import { EventPublisher } from '../../ports/event-publisher.ts';
import { LaneKeys } from '../../runtime/lane-keys.ts';
import { Lanes } from '../../runtime/lanes.ts';

export class SetFilePreferenceUseCase extends Context.Service<
  SetFilePreferenceUseCase,
  {
    readonly execute: (
      input: SetFilePreferenceParams & SetFilePreferenceRequest,
    ) => Effect.Effect<
      SetFilePreferenceResponse,
      ProjectNotFoundError | FilePreferenceLimitError
    >;
  }
>()('@porcelain/server/SetFilePreferenceUseCase') {
  static readonly layer = Layer.effect(
    SetFilePreferenceUseCase,
    Effect.gen(function* () {
      const checkProjectCapability = yield* CheckProjectService;
      const setFilePreferenceCapability = yield* SetFilePreferenceService;
      const lanesCapability = yield* Lanes;
      const laneKeysCapability = yield* LaneKeys;
      const eventsCapability = yield* EventPublisher;

      return {
        execute: Effect.fn('SetFilePreferenceUseCase.execute')(function* (
          input: SetFilePreferenceParams & SetFilePreferenceRequest,
        ): Effect.fn.Return<
          SetFilePreferenceResponse,
          ProjectNotFoundError | FilePreferenceLimitError
        > {
          const project = yield* checkProjectCapability.execute({
            projectId: input.projectId,
          });
          const result = yield* lanesCapability.run(
            laneKeysCapability.project(project),
            'write',
            () => setFilePreferenceCapability.execute(input),
          );
          if (result.changed)
            yield* eventsCapability.projectChanged({
              projectId: input.projectId,
              change: 'preferences',
            });
          return { preferences: result.preferences };
        }),
      };
    }),
  );
}
