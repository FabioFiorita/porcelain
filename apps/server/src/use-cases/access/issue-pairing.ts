import { Effect } from 'effect';
import type {
  InvalidPairingAddressError,
  InvalidDeviceDetailsError,
  MissingEnvironmentIdentityError,
} from '@porcelain/access/errors';
import type {
  IssuePairingService,
  ReadEnvironmentService,
} from '@porcelain/access/services';
import type {
  IssuePairingRequest,
  IssuePairingResponse,
} from '@porcelain/contracts/access';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';

export class IssuePairingUseCase {
  private readonly readEnvironment: ReadEnvironmentService;
  private readonly issuePairing: IssuePairingService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;

  constructor(
    readEnvironment: ReadEnvironmentService,
    issuePairing: IssuePairingService,
    lanes: Lanes,
    laneKeys: LaneKeys,
  ) {
    this.readEnvironment = readEnvironment;
    this.issuePairing = issuePairing;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
  }

  execute(
    input: IssuePairingRequest,
  ): Effect.Effect<
    IssuePairingResponse,
    | InvalidPairingAddressError
    | InvalidDeviceDetailsError
    | MissingEnvironmentIdentityError
  > {
    return Effect.gen({ self: this }, function* () {
      return yield* this.lanes.run(this.laneKeys.access(), 'write', () =>
        Effect.gen({ self: this }, function* () {
          const { environmentId } = yield* this.readEnvironment.execute();
          return yield* this.issuePairing.execute({ ...input, environmentId });
        }),
      );
    });
  }
}
