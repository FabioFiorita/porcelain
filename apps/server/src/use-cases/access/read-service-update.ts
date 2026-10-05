import type { Context } from 'effect';
import { Effect } from 'effect';
import type {
  AuthorizeServiceUpdateService,
  PlanServiceUpdateCheckService,
} from '@porcelain/access/services';
import type {
  ReadServiceUpdateRequest,
  ReadServiceUpdateResponse,
} from '@porcelain/contracts/access';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { ServiceUpdateRunner } from '../../ports/service-update-runner.ts';

export class ReadServiceUpdateUseCase {
  private readonly updates: ServiceUpdateRunner;
  private readonly authorizeServiceUpdate: Context.Service.Shape<
    typeof AuthorizeServiceUpdateService
  >;
  private readonly planCheck: Context.Service.Shape<
    typeof PlanServiceUpdateCheckService
  >;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;

  constructor(
    updates: ServiceUpdateRunner,
    authorizeServiceUpdate: Context.Service.Shape<
      typeof AuthorizeServiceUpdateService
    >,
    planCheck: Context.Service.Shape<typeof PlanServiceUpdateCheckService>,
    lanes: Lanes,
    laneKeys: LaneKeys,
  ) {
    this.updates = updates;
    this.authorizeServiceUpdate = authorizeServiceUpdate;
    this.planCheck = planCheck;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
  }

  execute(
    input: ReadServiceUpdateRequest,
  ): Effect.Effect<ReadServiceUpdateResponse, never> {
    return Effect.gen({ self: this }, function* () {
      const check = yield* this.planCheck.execute();
      const authority = yield* this.lanes.run(
        this.laneKeys.access(),
        'read',
        () =>
          Effect.gen({ self: this }, function* () {
            return yield* this.authorizeServiceUpdate.execute(input);
          }),
      );
      return yield* this.lanes.run(this.laneKeys.serviceUpdate(), 'read', () =>
        Effect.gen({ self: this }, function* () {
          return {
            ...(yield* this.updates.read(check)),
            ...authority,
          };
        }),
      );
    });
  }
}
