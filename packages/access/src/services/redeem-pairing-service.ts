import { InvalidPairingError } from '../errors/invalid-pairing-error.ts';
import type { Device } from '../models/device.ts';
import type {
  RedeemPairingInput,
  RedeemPairingResult,
} from '../models/redeem-pairing.ts';
import type { Clock } from '../ports/clock.ts';
import type { IdSource } from '../ports/id-source.ts';
import type { PairingGrantStore } from '../ports/pairing-grant-store.ts';
import {
  hashSecret,
  mintCredential,
  parseCredential,
  secretMatches,
} from '../rules/credential.ts';
import { checkedLabel, checkedPlatform } from '../rules/device-details.ts';
import { pairingGrantRedeemable } from '../rules/pairing-grant.ts';

export class RedeemPairingService {
  private readonly pairingGrantStore: PairingGrantStore;
  private readonly clock: Clock;
  private readonly idSource: IdSource;

  constructor(
    pairingGrantStore: PairingGrantStore,
    clock: Clock,
    idSource: IdSource,
  ) {
    this.pairingGrantStore = pairingGrantStore;
    this.clock = clock;
    this.idSource = idSource;
  }

  execute(input: RedeemPairingInput): RedeemPairingResult {
    const code = parseCredential('pcp', input.code);
    if (!code) throw new InvalidPairingError();
    const label =
      input.label === undefined ? undefined : checkedLabel(input.label);
    const platform = checkedPlatform(input.platform);
    const now = this.clock.now();
    const grant = this.pairingGrantStore.find(code.id);
    if (
      !grant ||
      !secretMatches(grant.secretHash, code.secret) ||
      !pairingGrantRedeemable(grant, now)
    )
      throw new InvalidPairingError();
    const credential = mintCredential('pcd', this.idSource.next());
    const device: Device = {
      id: credential.id,
      label: label ?? grant.label,
      platform,
      createdAt: now,
      lastSeenAt: now,
    };
    this.pairingGrantStore.redeem({
      grantId: grant.id,
      redeemedAt: now,
      device: { ...device, secretHash: hashSecret(credential.secret) },
    });
    return { device, credential: credential.token };
  }
}
