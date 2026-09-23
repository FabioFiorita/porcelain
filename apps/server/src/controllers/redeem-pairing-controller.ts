import type {
  DeviceRegistration,
  RedeemedPairing,
} from '@porcelain/access/models';
import type { RedeemPairingService } from '@porcelain/access/services';

type RunStored = <T>(operation: () => T | Promise<T>) => Promise<T>;

export class RedeemPairingController {
  private readonly redeemPairing: RedeemPairingService;
  private readonly runStored: RunStored;

  constructor(redeemPairing: RedeemPairingService, runStored: RunStored) {
    this.redeemPairing = redeemPairing;
    this.runStored = runStored;
  }

  execute(
    input: { code: string } & DeviceRegistration,
  ): Promise<RedeemedPairing> {
    return this.runStored(() =>
      this.redeemPairing.execute(input.code, {
        platform: input.platform,
        ...(input.label === undefined ? {} : { label: input.label }),
      }),
    );
  }
}
