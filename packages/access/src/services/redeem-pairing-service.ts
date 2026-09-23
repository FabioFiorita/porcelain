import {
  hashSecret,
  mintCredential,
  parseCredential,
} from '../models/credential.ts';
import { checkedLabel, checkedPlatform } from '../models/device-details.ts';
import type { DeviceRegistration, RedeemedPairing } from '../models/pairing.ts';
import { InvalidPairingError } from '../errors/invalid-pairing-error.ts';
import type { DeviceRegistry } from '../ports/device-registry.ts';
import type { PairingGrantStore } from '../ports/pairing-grant-store.ts';

export class RedeemPairingService {
  private readonly grants: PairingGrantStore;
  private readonly directory: DeviceRegistry;
  private readonly now: () => number;

  constructor(
    grants: PairingGrantStore,
    directory: DeviceRegistry,
    now: () => number = Date.now,
  ) {
    this.grants = grants;
    this.directory = directory;
    this.now = now;
  }

  execute(code: string, registration: DeviceRegistration): RedeemedPairing {
    const parsed = parseCredential('pcp', code);
    if (!parsed) throw new InvalidPairingError();
    const at = this.now();
    const credential = mintCredential('pcd');
    const device = this.grants.redeem({
      grantId: parsed.id,
      secret: parsed.secret,
      now: new Date(at).toISOString(),
      device: {
        id: credential.id,
        label: registration.label ? checkedLabel(registration.label) : '',
        platform: checkedPlatform(registration.platform),
        secretHash: hashSecret(credential.secret),
        createdAt: new Date(at).toISOString(),
      },
    });
    if (!device) throw new InvalidPairingError();
    this.directory.add({
      ...device,
      secretHash: hashSecret(credential.secret),
    });
    return { device, credential: credential.token };
  }
}
