import { Effect } from 'effect';
import type {
  UntrustedDeviceError,
  ServiceNotManagedError,
  ServiceUpdateRunningError,
  ServiceUpdateNotOfferedError,
} from '@porcelain/access/errors';
import type {
  AuthorizeServiceUpdateService,
  CheckServiceUpdateService,
  PlanServiceUpdateCheckService,
} from '@porcelain/access/services';
import type {
  StartServiceUpdateInput,
  StartServiceUpdateResponse,
} from '@porcelain/contracts/access';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { ServiceUpdateRunner } from '../../ports/service-update-runner.ts';

export class StartServiceUpdateUseCase {
  private readonly updates: ServiceUpdateRunner;
  private readonly authorizeServiceUpdate: AuthorizeServiceUpdateService;
  private readonly checkServiceUpdate: CheckServiceUpdateService;
  private readonly planCheck: PlanServiceUpdateCheckService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;

  constructor(
    updates: ServiceUpdateRunner,
    authorizeServiceUpdate: AuthorizeServiceUpdateService,
    checkServiceUpdate: CheckServiceUpdateService,
    planCheck: PlanServiceUpdateCheckService,
    lanes: Lanes,
    laneKeys: LaneKeys,
  ) {
    this.updates = updates;
    this.authorizeServiceUpdate = authorizeServiceUpdate;
    this.checkServiceUpdate = checkServiceUpdate;
    this.planCheck = planCheck;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
  }

  execute(
    input: StartServiceUpdateInput,
  ): Effect.Effect<
    StartServiceUpdateResponse,
    | UntrustedDeviceError
    | ServiceNotManagedError
    | ServiceUpdateRunningError
    | ServiceUpdateNotOfferedError
  > {
    return Effect.gen({ self: this }, function* () {
      const check = yield* this.planCheck.execute();
      const target = { version: input.version };
      const authority = yield* this.lanes.run(
        this.laneKeys.access(),
        'read',
        () =>
          Effect.gen({ self: this }, function* () {
            return yield* this.authorizeServiceUpdate.execute({
              viewer: input.viewer,
              local: input.local,
            });
          }),
      );
      return yield* this.lanes.run(this.laneKeys.serviceUpdate(), 'write', () =>
        Effect.gen({ self: this }, function* () {
          yield* this.checkServiceUpdate.execute({
            authority,
            state: yield* this.updates.read(check),
            target,
          });
          yield* this.updates.start(target);
          return { ...(yield* this.updates.read(check)), ...authority };
        }),
      );
    });
  }
}
