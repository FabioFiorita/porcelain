import type { Clock, IdSource } from '@porcelain/kernel/ports';
import { sha256Hex } from '@porcelain/kernel/rules';
import { InvalidDeviceDetailsError } from '../errors/invalid-device-details-error.ts';
import { InvalidPairingError } from '../errors/invalid-pairing-error.ts';
import type { Device, DeviceDetailLimits } from '../models/device.ts';
import type {
  RedeemPairingInput,
  RedeemPairingResult,
} from '../models/redeem-pairing.ts';
import type { PairingGrantStore } from '../ports/pairing-grant-store.ts';
import type { SecretSource } from '../ports/secret-source.ts';
import {
  credential,
  parseCredential,
  secretMatches,
} from '../rules/credential.ts';
import { validLabel, validPlatform } from '../rules/device-details.ts';
import { pairingGrantRedeemable } from '../rules/pairing-grant.ts';

export class RedeemPairingService {
  private readonly pairingGrants: PairingGrantStore;
  private readonly clock: Clock;
  private readonly idSource: IdSource;
  private readonly secretSource: SecretSource;
  private readonly deviceDetails: DeviceDetailLimits;

  constructor(
    pairingGrants: PairingGrantStore,
    clock: Clock,
    idSource: IdSource,
    secretSource: SecretSource,
    deviceDetails: DeviceDetailLimits,
  ) {
    this.pairingGrants = pairingGrants;
    this.clock = clock;
    this.idSource = idSource;
    this.secretSource = secretSource;
    this.deviceDetails = deviceDetails;
  }

  execute(input: RedeemPairingInput): RedeemPairingResult {
    const code = parseCredential('pcp', input.code);
    if (!code) throw new InvalidPairingError();
    const label =
      input.label === undefined
        ? undefined
        : this.detail(validLabel(input.label, this.deviceDetails.labelLength));
    const platform = this.detail(
      validPlatform(input.platform, this.deviceDetails.platformLength),
    );
    const now = this.clock.now();
    const grant = this.pairingGrants.find({ grantId: code.id });
    if (
      !grant ||
      !secretMatches(grant.secretHash, code.secret) ||
      !pairingGrantRedeemable(grant, now)
    )
      throw new InvalidPairingError();
    const issued = credential(
      'pcd',
      this.idSource.next(),
      this.secretSource.next(),
    );
    const device: Device = {
      id: issued.id,
      label: label ?? grant.label,
      platform,
      createdAt: now,
      lastSeenAt: now,
    };
    this.pairingGrants.redeem({
      grant,
      redeemedAt: now,
      device: { ...device, secretHash: sha256Hex(issued.secret) },
    });
    return { device, credential: issued.token };
  }

  private detail(value: string | undefined): string {
    if (value === undefined) throw new InvalidDeviceDetailsError();
    return value;
  }
}
