import { type SharingManagementRequiredError } from '@porcelain/access/errors';
import { Context, Effect, Layer } from 'effect';
import {
  AuthorizeSharingService,
  ListAccessService,
} from '@porcelain/access/services';
import {
  type ListAccessRequest,
  type ListAccessResponse,
} from '@porcelain/contracts/access';
import { LaneKeys } from '../../runtime/lane-keys.ts';
import { Lanes } from '../../runtime/lanes.ts';

export class ListAccessUseCase extends Context.Service<
  ListAccessUseCase,
  {
    readonly execute: (
      input: ListAccessRequest,
    ) => Effect.Effect<ListAccessResponse, SharingManagementRequiredError>;
  }
>()('@porcelain/server/ListAccessUseCase') {
  static readonly layer = Layer.effect(
    ListAccessUseCase,
    Effect.gen(function* () {
      const authorizeSharing = yield* AuthorizeSharingService;
      const listAccessCapability = yield* ListAccessService;
      const lanesCapability = yield* Lanes;
      const laneKeysCapability = yield* LaneKeys;

      return {
        execute: Effect.fn('ListAccessUseCase.execute')(function* (
          input: ListAccessRequest,
        ): Effect.fn.Return<
          ListAccessResponse,
          SharingManagementRequiredError
        > {
          const { viewer } = input;
          return yield* lanesCapability.run(
            laneKeysCapability.access(),
            'read',
            () =>
              Effect.gen(function* () {
                yield* authorizeSharing.execute(input);
                const access = yield* listAccessCapability.execute({
                  viewerDeviceId:
                    viewer.kind === 'device' ? viewer.deviceId : undefined,
                });
                return {
                  ...access,
                  canEditIdentity: input.local || viewer.kind === 'owner',
                };
              }),
          );
        }),
      };
    }),
  );
}
